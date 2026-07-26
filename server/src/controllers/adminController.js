import prisma from '../utils/db.js';
import bcrypt from 'bcryptjs';
import { logAudit, AUDIT_ACTIONS, computeDiff } from '../utils/audit.js';

// --- Analytics Endpoint ---
export const getAnalytics = async (req, res) => {
  try {
    // 1. Core counters
    const totalDepartments = await prisma.department.count();
    const totalStudents = await prisma.student.count();
    const totalFaculty = await prisma.faculty.count();
    const totalSubjects = await prisma.subject.count();

    // 2. Department student count breakdown
    const departments = await prisma.department.findMany({
      include: {
        students: true,
      },
    });
    const deptBreakdown = departments.map((d) => ({
      name: d.name,
      code: d.code,
      studentCount: d.students.length,
    }));

    // 3. Batch-wise attendance average
    const students = await prisma.student.findMany({
      include: {
        attendance: true,
      },
    });

    const batches = [...new Set(students.map((s) => s.batchYear))];
    const batchAttendance = batches.map((batch) => {
      const batchStudents = students.filter((s) => s.batchYear === batch);
      let totalCount = 0;
      let presentCount = 0;

      batchStudents.forEach((student) => {
        student.attendance.forEach((att) => {
          totalCount++;
          if (att.status === 'PRESENT') {
            presentCount++;
          }
        });
      });

      const percentage = totalCount > 0 ? parseFloat(((presentCount / totalCount) * 100).toFixed(2)) : 100.0;
      return {
        batch,
        percentage,
        studentCount: batchStudents.length,
      };
    });

    // 4. Batch-wise average exam marks
    // Calculate GPA/Average marks out of 100
    const marks = await prisma.mark.findMany({
      include: {
        student: true,
      },
    });

    const batchMarks = batches.map((batch) => {
      const batchMarksRecords = marks.filter((m) => m.student.batchYear === batch);
      let totalWeightedObtained = 0;
      let totalWeightedMax = 0;

      batchMarksRecords.forEach((m) => {
        // Convert to percentage weight
        totalWeightedObtained += m.marksObtained;
        totalWeightedMax += m.maxMarks;
      });

      const averagePercentage = totalWeightedMax > 0
        ? parseFloat(((totalWeightedObtained / totalWeightedMax) * 100).toFixed(2))
        : 80.0; // default/seed average if no marks

      return {
        batch,
        averagePercentage,
      };
    });

    res.json({
      counters: {
        departments: totalDepartments,
        students: totalStudents,
        faculty: totalFaculty,
        subjects: totalSubjects,
      },
      departments: deptBreakdown,
      attendanceByBatch: batchAttendance,
      marksByBatch: batchMarks,
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ message: 'Server error loading analytics' });
  }
};

// --- Settings Management ---
export const updateSetting = async (req, res) => {
  try {
    const { key, value } = req.body;

    if (!key || value === undefined) {
      return res.status(400).json({ message: 'Key and Value are required' });
    }

    const setting = await prisma.setting.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) },
    });

    res.json({ message: 'Setting updated successfully', setting });
  } catch (error) {
    console.error('Error updating setting:', error);
    res.status(500).json({ message: 'Server error updating setting' });
  }
};

export const getSettings = async (req, res) => {
  try {
    const settings = await prisma.setting.findMany();
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Export Report Data ---
export const getExportData = async (req, res) => {
  try {
    const students = await prisma.student.findMany({
      include: {
        user: { select: { name: true, email: true } },
        department: { select: { code: true } },
        attendance: true,
        marks: true,
      },
      orderBy: { rollNo: 'asc' },
    });

    const exportRows = students.map((student) => {
      // Calculate overall attendance
      const totalAtt = student.attendance.length;
      const presentAtt = student.attendance.filter(a => a.status === 'PRESENT').length;
      const attendancePct = totalAtt > 0 ? ((presentAtt / totalAtt) * 100).toFixed(1) + '%' : '100%';

      // Calculate average marks
      const semesterMarks = student.marks.filter(m => m.examType === 'SEMESTER');
      let avgSemMarks = 'N/A';
      if (semesterMarks.length > 0) {
        const totalMax = semesterMarks.reduce((sum, m) => sum + m.maxMarks, 0);
        const totalObtained = semesterMarks.reduce((sum, m) => sum + m.marksObtained, 0);
        avgSemMarks = totalMax > 0 ? ((totalObtained / totalMax) * 100).toFixed(1) + '%' : '0%';
      }

      return {
        RollNo: student.rollNo,
        Name: student.user.name,
        Email: student.user.email,
        Department: student.department.code,
        Batch: student.batchYear,
        Section: student.section,
        Mobile: student.mobileNo,
        GuardianContact: student.guardianContact,
        OverallAttendance: attendancePct,
        SemesterAverage: avgSemMarks,
      };
    });

    res.json(exportRows);
  } catch (error) {
    console.error('Error compiling export data:', error);
    res.status(500).json({ message: 'Server error compiles export data' });
  }
};

// --- CRUD: DEPARTMENTS ---
export const getDepartments = async (req, res) => {
  try {
    const list = await prisma.department.findMany({ orderBy: { code: 'asc' } });
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching departments' });
  }
};

export const createDepartment = async (req, res) => {
  try {
    const { name, code } = req.body;
    if (!name || !code) return res.status(400).json({ message: 'Name and Code are required' });

    const existing = await prisma.department.findUnique({ where: { code } });
    if (existing) return res.status(400).json({ message: 'Department with this code already exists' });

    const newDept = await prisma.department.create({ data: { name, code: code.toUpperCase() } });
    res.status(201).json(newDept);
  } catch (error) {
    res.status(500).json({ message: 'Error creating department' });
  }
};

export const updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code } = req.body;

    const updated = await prisma.department.update({
      where: { id },
      data: { name, code: code?.toUpperCase() },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Error updating department' });
  }
};

export const deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.department.delete({ where: { id } });
    res.json({ message: 'Department deleted successfully' });
  } catch (error) {
    res.status(400).json({ message: 'Cannot delete department. Make sure it contains no students, faculty, or subjects.' });
  }
};

// --- CRUD: SUBJECTS ---
export const getSubjects = async (req, res) => {
  try {
    const list = await prisma.subject.findMany({
      include: {
        department: { select: { name: true, code: true } },
        faculty: { include: { user: { select: { name: true } } } },
      },
      orderBy: { code: 'asc' },
    });
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching subjects' });
  }
};

export const createSubject = async (req, res) => {
  try {
    const { name, code, semester, departmentId, facultyId } = req.body;
    if (!name || !code || !semester || !departmentId || !facultyId) {
      return res.status(400).json({ message: 'All subject fields are required' });
    }

    const existing = await prisma.subject.findUnique({ where: { code } });
    if (existing) return res.status(400).json({ message: 'Subject with this code already exists' });

    const newSub = await prisma.subject.create({
      data: { name, code: code.toUpperCase(), semester: Number(semester), departmentId, facultyId },
    });
    res.status(201).json(newSub);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error creating subject' });
  }
};

export const updateSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, semester, departmentId, facultyId } = req.body;

    const updated = await prisma.subject.update({
      where: { id },
      data: { name, code: code?.toUpperCase(), semester: semester ? Number(semester) : undefined, departmentId, facultyId },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Error updating subject' });
  }
};

export const deleteSubject = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.subject.delete({ where: { id } });
    res.json({ message: 'Subject deleted successfully' });
  } catch (error) {
    res.status(400).json({ message: 'Cannot delete subject. Make sure it has no attendance or marks history.' });
  }
};

// --- CRUD: FACULTY ---
export const getFaculty = async (req, res) => {
  try {
    const list = await prisma.faculty.findMany({
      include: {
        user: { select: { name: true, email: true } },
        department: { select: { name: true, code: true } },
      },
    });
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching faculty' });
  }
};

export const updateFaculty = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, designation, departmentId } = req.body;

    const profile = await prisma.faculty.findUnique({ where: { id }, include: { user: true } });
    if (!profile) return res.status(404).json({ message: 'Faculty not found' });

    const prevData = {
      name: profile.user.name,
      email: profile.user.email,
      designation: profile.designation,
      departmentId: profile.departmentId
    };

    const nextData = {
      name,
      email,
      designation,
      departmentId
    };

    const { diffPrev, diffNew, hasChanges } = computeDiff(prevData, nextData);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: profile.userId },
        data: { name, email, departmentId },
      });

      const updatedProfile = await tx.faculty.update({
        where: { id },
        data: { designation, departmentId },
      });

      if (hasChanges) {
        await logAudit({
          actorUserId: req.user.id,
          actorRole: req.user.role,
          action: AUDIT_ACTIONS.FACULTY_UPDATED,
          entityType: 'FACULTY',
          entityId: id,
          previousValue: diffPrev,
          newValue: diffNew,
          req
        }, tx);
      }

      return { user, updatedProfile };
    });

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error updating faculty' });
  }
};

export const deleteFaculty = async (req, res) => {
  try {
    const { id } = req.params;
    const profile = await prisma.faculty.findUnique({ where: { id }, include: { user: true } });
    if (!profile) return res.status(404).json({ message: 'Faculty profile not found' });

    // Transaction to delete user and log audit
    await prisma.$transaction(async (tx) => {
      // First check if they teach any subjects
      const subjects = await tx.subject.findFirst({ where: { facultyId: id } });
      if (subjects) {
        throw new Error('Cannot delete faculty member who is assigned to teach subjects.');
      }
      await tx.user.delete({ where: { id: profile.userId } });

      await logAudit({
        actorUserId: req.user.id,
        actorRole: req.user.role,
        action: AUDIT_ACTIONS.FACULTY_DELETED,
        entityType: 'FACULTY',
        entityId: id,
        previousValue: {
          id: profile.id,
          name: profile.user.name,
          email: profile.user.email,
          designation: profile.designation,
          departmentId: profile.departmentId
        },
        newValue: null,
        req
      }, tx);
    });

    res.json({ message: 'Faculty deleted successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message || 'Error deleting faculty' });
  }
};

// --- CRUD: STUDENTS ---
export const getStudents = async (req, res) => {
  try {
    const list = await prisma.student.findMany({
      include: {
        user: { select: { name: true, email: true } },
        department: { select: { name: true, code: true } },
      },
      orderBy: { rollNo: 'asc' },
    });
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching students' });
  }
};

export const updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, rollNo, batchYear, section, mobileNo, guardianContact, departmentId } = req.body;

    const profile = await prisma.student.findUnique({
      where: { id },
      include: { user: true }
    });
    if (!profile) return res.status(404).json({ message: 'Student not found' });

    // Compare fields to detect diffs
    const prevData = {
      name: profile.user.name,
      email: profile.user.email,
      departmentId: profile.departmentId,
      rollNo: profile.rollNo,
      batchYear: profile.batchYear,
      section: profile.section,
      mobileNo: profile.mobileNo,
      guardianContact: profile.guardianContact
    };

    const nextData = {
      name,
      email,
      departmentId,
      rollNo,
      batchYear,
      section,
      mobileNo,
      guardianContact
    };

    const { diffPrev, diffNew, hasChanges } = computeDiff(prevData, nextData);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: profile.userId },
        data: { name, email, departmentId },
      });

      const updatedProfile = await tx.student.update({
        where: { id },
        data: { rollNo, batchYear, section, mobileNo, guardianContact, departmentId },
      });

      if (hasChanges) {
        await logAudit({
          actorUserId: req.user.id,
          actorRole: req.user.role,
          action: AUDIT_ACTIONS.STUDENT_UPDATED,
          entityType: 'STUDENT',
          entityId: id,
          previousValue: diffPrev,
          newValue: diffNew,
          req
        }, tx);
      }

      return { user, updatedProfile };
    });

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error updating student' });
  }
};

export const deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const profile = await prisma.student.findUnique({
      where: { id },
      include: { user: true }
    });
    if (!profile) return res.status(404).json({ message: 'Student not found' });

    // Transaction to cascade delete user and record audit log
    await prisma.$transaction(async (tx) => {
      await tx.user.delete({ where: { id: profile.userId } });

      await logAudit({
        actorUserId: req.user.id,
        actorRole: req.user.role,
        action: AUDIT_ACTIONS.STUDENT_DELETED,
        entityType: 'STUDENT',
        entityId: id,
        previousValue: {
          id: profile.id,
          rollNo: profile.rollNo,
          batchYear: profile.batchYear,
          section: profile.section,
          name: profile.user.name,
          email: profile.user.email,
          departmentId: profile.departmentId
        },
        newValue: null,
        req
      }, tx);
    });

    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: 'Error deleting student' });
  }
};
