import prisma from '../utils/db.js';

export const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const student = await prisma.student.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            role: true,
            createdAt: true,
          },
        },
        department: {
          select: {
            name: true,
            code: true,
          },
        },
      },
    });

    if (!student) {
      return res.status(404).json({ message: 'Student profile not found' });
    }

    res.json(student);
  } catch (error) {
    console.error('Error fetching student profile:', error);
    res.status(500).json({ message: 'Server error fetching profile' });
  }
};

export const getAttendance = async (req, res) => {
  try {
    const studentId = req.user.studentId;
    if (!studentId) {
      return res.status(400).json({ message: 'User is not a student or student ID is missing in token' });
    }

    // Fetch student subjects to list even those with 0 attendance marked
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { department: true },
    });

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Find all subjects for this student's department and semester
    // To make it simple, we can find subjects of the student's department
    const subjects = await prisma.subject.findMany({
      where: {
        departmentId: student.departmentId,
      },
    });

    const attendanceRecords = await prisma.attendance.findMany({
      where: { studentId },
      include: {
        subject: true,
      },
    });

    // Fetch threshold from settings
    const thresholdSetting = await prisma.setting.findUnique({
      where: { key: 'low_attendance_threshold' },
    });
    const threshold = parseFloat(thresholdSetting?.value || '75');

    // Aggregate by subject
    const subjectWise = subjects.map((sub) => {
      const records = attendanceRecords.filter((r) => r.subjectId === sub.id);
      const present = records.filter((r) => r.status === 'PRESENT').length;
      const absent = records.filter((r) => r.status === 'ABSENT').length;
      const total = records.length;
      const percentage = total > 0 ? parseFloat(((present / total) * 100).toFixed(2)) : 100.0;

      return {
        subjectId: sub.id,
        subjectName: sub.name,
        subjectCode: sub.code,
        present,
        absent,
        total,
        percentage,
        isLow: percentage < threshold,
      };
    });

    // Overall attendance calculation
    const totalRecords = attendanceRecords.length;
    const totalPresent = attendanceRecords.filter((r) => r.status === 'PRESENT').length;
    const overallPercentage = totalRecords > 0 
      ? parseFloat(((totalPresent / totalRecords) * 100).toFixed(2)) 
      : 100.0;

    res.json({
      overall: {
        present: totalPresent,
        total: totalRecords,
        percentage: overallPercentage,
        threshold,
        isLow: overallPercentage < threshold,
      },
      subjectWise,
    });
  } catch (error) {
    console.error('Error fetching attendance:', error);
    res.status(500).json({ message: 'Server error fetching attendance' });
  }
};

export const getMarks = async (req, res) => {
  try {
    const studentId = req.user.studentId;
    if (!studentId) {
      return res.status(400).json({ message: 'User is not a student' });
    }

    const marks = await prisma.mark.findMany({
      where: { studentId },
      include: {
        subject: {
          select: {
            name: true,
            code: true,
          },
        },
      },
      orderBy: [
        { subject: { code: 'asc' } },
        { examType: 'asc' },
      ],
    });

    // Structure marks for easier UI consumption: group by subject
    const groupedMarks = {};
    marks.forEach((m) => {
      const code = m.subject.code;
      if (!groupedMarks[code]) {
        groupedMarks[code] = {
          subjectName: m.subject.name,
          subjectCode: code,
          marks: {},
        };
      }
      groupedMarks[code].marks[m.examType] = {
        obtained: m.marksObtained,
        max: m.maxMarks,
        percentage: parseFloat(((m.marksObtained / m.maxMarks) * 100).toFixed(2)),
      };
    });

    res.json(Object.values(groupedMarks));
  } catch (error) {
    console.error('Error fetching marks:', error);
    res.status(500).json({ message: 'Server error fetching marks' });
  }
};

export const getNotifications = async (req, res) => {
  try {
    const studentId = req.user.studentId;
    if (!studentId) {
      return res.status(400).json({ message: 'User is not a student' });
    }

    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });

    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Server error fetching notifications' });
  }
};

export const markNotificationAsRead = async (req, res) => {
  try {
    const studentId = req.user.studentId;
    const { id } = req.params;

    if (!studentId) {
      return res.status(400).json({ message: 'User is not a student' });
    }

    const updated = await prisma.notification.updateMany({
      where: {
        id,
        userId: req.user.id, // Security: ensure notification belongs to user
      },
      data: {
        readStatus: true,
      },
    });

    if (updated.count === 0) {
      return res.status(404).json({ message: 'Notification not found or access denied' });
    }

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification read:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
