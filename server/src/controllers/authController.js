import prisma from '../utils/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['STUDENT', 'FACULTY', 'ADMIN']),
  departmentId: z.string().optional(),
  // For Student profiles
  rollNo: z.string().optional(),
  batchYear: z.string().optional(),
  section: z.string().optional(),
  mobileNo: z.string().optional(),
  guardianContact: z.string().optional(),
  // For Faculty profiles
  designation: z.string().optional(),
});

const JWT_SECRET = process.env.JWT_SECRET || 'vit_student_portal_jwt_secret_key_2026_super_secure';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'vit_student_portal_jwt_refresh_secret_key_2026_super_secure';

const generateTokens = (user, studentProfile, facultyProfile) => {
  const payload = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    studentId: studentProfile?.id || null,
    facultyId: facultyProfile?.id || null,
    departmentId: user.departmentId || null,
  };

  const accessToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '8h',
  });

  const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d',
  });

  return { accessToken, refreshToken };
};

export const login = async (req, res) => {
  try {
    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: 'Validation failed', errors: validation.error.format() });
    }

    const { email, password } = validation.data;

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        studentProfile: true,
        facultyProfile: true,
        department: true,
      },
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const { accessToken, refreshToken } = generateTokens(
      user,
      user.studentProfile,
      user.facultyProfile
    );

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department ? { id: user.department.id, name: user.department.name, code: user.department.code } : null,
        studentId: user.studentProfile?.id || null,
        facultyId: user.facultyProfile?.id || null,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
};

export const register = async (req, res) => {
  try {
    // Only administrators can register new accounts
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Access denied: Admin permissions required' });
    }

    const validation = registerSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: 'Validation failed', errors: validation.error.format() });
    }

    const data = validation.data;

    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Hash Password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Create user and profile in transaction to ensure consistency
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: data.name,
          email: data.email,
          passwordHash: hashedPassword,
          role: data.role,
          departmentId: data.departmentId || null,
        },
      });

      let studentProfile = null;
      let facultyProfile = null;

      if (data.role === 'STUDENT') {
        if (!data.rollNo || !data.batchYear || !data.section || !data.departmentId) {
          throw new Error('Student rollNo, batchYear, section, and departmentId are required.');
        }

        const existingRoll = await tx.student.findUnique({
          where: { rollNo: data.rollNo },
        });

        if (existingRoll) {
          throw new Error('Student with this roll number already exists.');
        }

        studentProfile = await tx.student.create({
          data: {
            userId: user.id,
            rollNo: data.rollNo,
            batchYear: data.batchYear,
            section: data.section,
            mobileNo: data.mobileNo || '',
            guardianContact: data.guardianContact || '',
            departmentId: data.departmentId,
          },
        });
      } else if (data.role === 'FACULTY') {
        if (!data.departmentId || !data.designation) {
          throw new Error('Faculty departmentId and designation are required.');
        }

        facultyProfile = await tx.faculty.create({
          data: {
            userId: user.id,
            departmentId: data.departmentId,
            designation: data.designation,
          },
        });
      }

      return { user, studentProfile, facultyProfile };
    });

    res.status(201).json({
      message: 'Account registered successfully',
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
        studentId: result.studentProfile?.id || null,
        facultyId: result.facultyProfile?.id || null,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: error.message || 'Server error during registration' });
  }
};

export const refreshToken = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ message: 'Refresh token is required' });
    }

    jwt.verify(token, JWT_REFRESH_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(403).json({ message: 'Invalid or expired refresh token' });
      }

      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        include: {
          studentProfile: true,
          facultyProfile: true,
        },
      });

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const tokens = generateTokens(user, user.studentProfile, user.facultyProfile);
      res.json({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ message: 'Server error during token refresh' });
  }
};
