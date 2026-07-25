import prisma from '../utils/db.js';
import { z } from 'zod';

const attendanceSchema = z.object({
  subjectId: z.string().uuid(),
  date: z.string(), // YYYY-MM-DD
  records: z.array(z.object({
    studentId: z.string().uuid(),
    status: z.enum(['PRESENT', 'ABSENT']),
  })),
});

const marksSchema = z.object({
  subjectId: z.string().uuid(),
  examType: z.enum(['INTERNAL1', 'INTERNAL2', 'SEMESTER']),
  maxMarks: z.number().positive(),
  records: z.array(z.object({
    studentId: z.string().uuid(),
    marksObtained: z.number().nonnegative(),
  })),
});

// Helper function to check and notify student if their attendance falls below threshold
async function checkLowAttendance(tx, studentId) {
  // Get threshold
  const thresholdSetting = await tx.setting.findUnique({
    where: { key: 'low_attendance_threshold' },
  });
  const threshold = parseFloat(thresholdSetting?.value || '75');

  // Calculate overall attendance
  const total = await tx.attendance.count({
    where: { studentId },
  });

  const present = await tx.attendance.count({
    where: { studentId, status: 'PRESENT' },
  });

  const percentage = total > 0 ? (present / total) * 100 : 100;

  if (percentage < threshold) {
    const roundedPercent = percentage.toFixed(1);
    const message = `Alert: Your overall attendance has dropped to ${roundedPercent}%, which is below the minimum required ${threshold}%. Please meet your class advisor.`;

    // Check if we already notified about this percent range in the last 24h to avoid spamming
    const existing = await tx.notification.findFirst({
      where: {
        studentId,
        type: 'LOW_ATTENDANCE',
        message: {
          contains: `dropped to ${roundedPercent}%`,
        },
      },
    });

    if (!existing) {
      await tx.notification.create({
        data: {
          studentId,
          message,
          type: 'LOW_ATTENDANCE',
        },
      });
    }
  }
}

export const getFacultySubjects = async (req, res) => {
  try {
    const facultyId = req.user.facultyId;
    if (!facultyId) {
      return res.status(400).json({ message: 'User is not a faculty member' });
    }

    const subjects = await prisma.subject.findMany({
      where: { facultyId },
      include: {
        department: {
          select: {
            name: true,
            code: true,
          },
        },
      },
    });

    res.json(subjects);
  } catch (error) {
    console.error('Error fetching faculty subjects:', error);
    res.status(500).json({ message: 'Server error fetching subjects' });
  }
};

export const getStudentsList = async (req, res) => {
  try {
    const { departmentId, batchYear, section } = req.query;

    if (!departmentId || !batchYear || !section) {
      return res.status(400).json({ message: 'departmentId, batchYear, and section are required query parameters' });
    }

    const students = await prisma.student.findMany({
      where: {
        departmentId,
        batchYear,
        section,
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        rollNo: 'asc',
      },
    });

    res.json(students);
  } catch (error) {
    console.error('Error fetching student list:', error);
    res.status(500).json({ message: 'Server error fetching students' });
  }
};

export const markAttendance = async (req, res) => {
  try {
    const validation = attendanceSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: 'Validation failed', errors: validation.error.format() });
    }

    const { subjectId, date, records } = validation.data;
    const markedById = req.user.id;

    // Use normalized Date object (Y-M-D) without time components for unique constraint match
    const formattedDate = new Date(date + 'T00:00:00.000Z');

    // Run in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete existing records for this subject and date to prevent duplicates and handle edits
      await tx.attendance.deleteMany({
        where: {
          subjectId,
          date: formattedDate,
          studentId: {
            in: records.map(r => r.studentId),
          },
        },
      });

      // Insert new records
      await tx.attendance.createMany({
        data: records.map((rec) => ({
          studentId: rec.studentId,
          subjectId,
          date: formattedDate,
          status: rec.status,
          markedById,
        })),
      });

      // Check attendance levels for each student and send alert if needed
      for (const rec of records) {
        await checkLowAttendance(tx, rec.studentId);
      }
    });

    res.status(200).json({ message: 'Attendance recorded successfully' });
  } catch (error) {
    console.error('Error marking attendance:', error);
    res.status(500).json({ message: 'Server error marking attendance' });
  }
};

export const updateAttendanceRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['PRESENT', 'ABSENT'].includes(status)) {
      return res.status(400).json({ message: 'Status must be PRESENT or ABSENT' });
    }

    const attendance = await prisma.attendance.update({
      where: { id },
      data: {
        status,
        markedById: req.user.id,
      },
    });

    // Check attendance level for student
    await prisma.$transaction(async (tx) => {
      await checkLowAttendance(tx, attendance.studentId);
    });

    res.json({ message: 'Attendance record updated successfully', attendance });
  } catch (error) {
    console.error('Error updating attendance record:', error);
    res.status(500).json({ message: 'Server error updating attendance' });
  }
};

export const enterMarks = async (req, res) => {
  try {
    const validation = marksSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: 'Validation failed', errors: validation.error.format() });
    }

    const { subjectId, examType, maxMarks, records } = validation.data;

    // Run in transaction
    await prisma.$transaction(async (tx) => {
      // Upsert marks: Delete existing ones first
      await tx.mark.deleteMany({
        where: {
          subjectId,
          examType,
          studentId: {
            in: records.map((r) => r.studentId),
          },
        },
      });

      // Insert new ones
      await tx.mark.createMany({
        data: records.map((rec) => {
          if (rec.marksObtained > maxMarks) {
            throw new Error(`Marks obtained (${rec.marksObtained}) cannot exceed max marks (${maxMarks}).`);
          }
          return {
            studentId: rec.studentId,
            subjectId,
            examType,
            maxMarks,
            marksObtained: rec.marksObtained,
          };
        }),
      });
    });

    res.json({ message: 'Marks updated successfully' });
  } catch (error) {
    console.error('Error entering marks:', error);
    res.status(500).json({ message: error.message || 'Server error entering marks' });
  }
};

// Retrieve existing attendance for checking or editing
export const getExistingAttendance = async (req, res) => {
  try {
    const { subjectId, date } = req.query;

    if (!subjectId || !date) {
      return res.status(400).json({ message: 'subjectId and date are required query parameters' });
    }

    const formattedDate = new Date(date + 'T00:00:00.000Z');

    const records = await prisma.attendance.findMany({
      where: {
        subjectId,
        date: formattedDate,
      },
      select: {
        id: true,
        studentId: true,
        status: true,
      },
    });

    res.json(records);
  } catch (error) {
    console.error('Error fetching existing attendance:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Retrieve existing marks for loading into editing spreadsheet
export const getExistingMarks = async (req, res) => {
  try {
    const { subjectId, examType } = req.query;

    if (!subjectId || !examType) {
      return res.status(400).json({ message: 'subjectId and examType are required query parameters' });
    }

    const records = await prisma.mark.findMany({
      where: {
        subjectId,
        examType: examType,
      },
      select: {
        id: true,
        studentId: true,
        marksObtained: true,
        maxMarks: true,
      },
    });

    res.json(records);
  } catch (error) {
    console.error('Error fetching existing marks:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
