import { PrismaClient, Role, Status, ExamType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Clear existing data in reverse order of dependencies
  await prisma.notification.deleteMany({});
  await prisma.assignmentSubmissionVersion.deleteMany({});
  await prisma.assignmentSubmission.deleteMany({});
  await prisma.assignment.deleteMany({});
  await prisma.mark.deleteMany({});
  await prisma.attendance.deleteMany({});
  await prisma.subject.deleteMany({});
  await prisma.faculty.deleteMany({});
  await prisma.student.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.department.deleteMany({});
  await prisma.setting.deleteMany({});

  console.log('Cleared existing data.');

  // 2. Create Settings
  const thresholdSetting = await prisma.setting.create({
    data: {
      key: 'low_attendance_threshold',
      value: '75',
    },
  });
  console.log(`Created Setting: ${thresholdSetting.key} = ${thresholdSetting.value}`);

  // 3. Create Department
  const aidsDept = await prisma.department.create({
    data: {
      name: 'Artificial Intelligence and Data Science',
      code: 'AIDS',
    },
  });
  const cseDept = await prisma.department.create({
    data: {
      name: 'Computer Science and Engineering',
      code: 'CSE',
    },
  });
  console.log('Created Departments.');

  // 4. Create Users (Admin, Faculty, Students)
  const passwordHash = await bcrypt.hash('password123', 10);

  // Admin User
  const adminUser = await prisma.user.create({
    data: {
      name: 'Admin Principal',
      email: 'admin@velammal.edu.in',
      passwordHash,
      role: Role.ADMIN,
    },
  });

  // Faculty Users
  const facultyUser1 = await prisma.user.create({
    data: {
      name: 'Dr. Ramesh Kumar',
      email: 'ramesh.kumar@velammal.edu.in',
      passwordHash,
      role: Role.FACULTY,
      departmentId: aidsDept.id,
    },
  });

  const facultyUser2 = await prisma.user.create({
    data: {
      name: 'Mrs. Priya Lakshmi',
      email: 'priya.lakshmi@velammal.edu.in',
      passwordHash,
      role: Role.FACULTY,
      departmentId: aidsDept.id,
    },
  });

  // Create Faculty Profiles
  const facultyProfile1 = await prisma.faculty.create({
    data: {
      userId: facultyUser1.id,
      departmentId: aidsDept.id,
      designation: 'Professor & Head',
    },
  });

  const facultyProfile2 = await prisma.faculty.create({
    data: {
      userId: facultyUser2.id,
      departmentId: aidsDept.id,
      designation: 'Assistant Professor',
    },
  });

  console.log('Created Faculty.');

  // Subjects
  const mlSubject = await prisma.subject.create({
    data: {
      name: 'Machine Learning',
      code: 'AD401',
      semester: 4,
      departmentId: aidsDept.id,
      facultyId: facultyProfile1.id,
    },
  });

  const dsSubject = await prisma.subject.create({
    data: {
      name: 'Data Science with Python',
      code: 'AD402',
      semester: 4,
      departmentId: aidsDept.id,
      facultyId: facultyProfile2.id,
    },
  });

  const statsSubject = await prisma.subject.create({
    data: {
      name: 'Probability and Statistics',
      code: 'MA401',
      semester: 4,
      departmentId: aidsDept.id,
      facultyId: facultyProfile1.id,
    },
  });

  const dsaSubject = await prisma.subject.create({
    data: {
      name: 'Data Structures and Algorithms',
      code: 'AD201',
      semester: 2,
      departmentId: aidsDept.id,
      facultyId: facultyProfile2.id,
    },
  });

  console.log('Created Subjects.');

  // Students mapping (Batch 2024-28 -> Sem 4, Batch 2025-29 -> Sem 2)
  // Let's create 3 students in Batch 2024-28 (AIDS, Section A)
  const students2024Data = [
    {
      name: 'Santhosh Kumar C',
      email: 'santhosh.c@student.velammal.edu.in',
      rollNo: '2024AIDS001',
      mobileNo: '9876543210',
      guardianContact: '9876543211',
      section: 'A',
      batch: '2024-28',
    },
    {
      name: 'Abishek R',
      email: 'abishek.r@student.velammal.edu.in',
      rollNo: '2024AIDS002',
      mobileNo: '9876543220',
      guardianContact: '9876543221',
      section: 'A',
      batch: '2024-28',
    },
    {
      name: 'Deepika S',
      email: 'deepika.s@student.velammal.edu.in',
      rollNo: '2024AIDS003',
      mobileNo: '9876543230',
      guardianContact: '9876543231',
      section: 'A',
      batch: '2024-28',
    },
  ];

  // Let's create 2 students in Batch 2025-29 (AIDS, Section A)
  const students2025Data = [
    {
      name: 'Gowtham V',
      email: 'gowtham.v@student.velammal.edu.in',
      rollNo: '2025AIDS001',
      mobileNo: '9876543240',
      guardianContact: '9876543241',
      section: 'A',
      batch: '2025-29',
    },
    {
      name: 'Kavya B',
      email: 'kavya.b@student.velammal.edu.in',
      rollNo: '2025AIDS002',
      mobileNo: '9876543250',
      guardianContact: '9876543251',
      section: 'A',
      batch: '2025-29',
    },
  ];

  const createdStudents = [];

  for (const s of [...students2024Data, ...students2025Data]) {
    const user = await prisma.user.create({
      data: {
        name: s.name,
        email: s.email,
        passwordHash,
        role: Role.STUDENT,
        departmentId: aidsDept.id,
      },
    });

    const student = await prisma.student.create({
      data: {
        userId: user.id,
        rollNo: s.rollNo,
        batchYear: s.batch,
        section: s.section,
        mobileNo: s.mobileNo,
        guardianContact: s.guardianContact,
        departmentId: aidsDept.id,
      },
      include: {
        user: true,
      },
    });
    createdStudents.push(student);
  }

  console.log('Created Students.');

  // 5. Generate Attendance records (for past 20 class days)
  // Let's say class days are weekdays from July 1, 2026 to July 24, 2026 (18 days).
  const dates = [];
  let current = new Date('2026-07-01');
  const end = new Date('2026-07-24');
  while (current <= end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) { // Weekdays
      dates.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }

  // Attendance for Batch 2024-28 (ML, DS, Stats are Sem 4 subjects)
  // Santhosh (2024AIDS001) - ~90% attendance
  // Abishek (2024AIDS002) - ~72% attendance (LOW!)
  // Deepika (2024AIDS003) - ~95% attendance
  const students2024 = createdStudents.filter(s => s.batchYear === '2024-28');
  const subjects2024 = [mlSubject, dsSubject, statsSubject];

  for (const date of dates) {
    for (const subject of subjects2024) {
      const markedBy = subject.facultyId === facultyProfile1.id ? facultyUser1.id : facultyUser2.id;
      
      for (const student of students2024) {
        let status = Status.PRESENT;
        
        // Custom attendance probabilities
        if (student.rollNo === '2024AIDS002') {
          // Abishek has lower attendance
          status = Math.random() < 0.70 ? Status.PRESENT : Status.ABSENT;
        } else if (student.rollNo === '2024AIDS001') {
          status = Math.random() < 0.90 ? Status.PRESENT : Status.ABSENT;
        } else {
          status = Math.random() < 0.96 ? Status.PRESENT : Status.ABSENT;
        }

        await prisma.attendance.create({
          data: {
            studentId: student.id,
            subjectId: subject.id,
            date: date,
            status: status,
            markedById: markedBy,
          },
        });
      }
    }
  }

  // Attendance for Batch 2025-29 (DSA is Sem 2 subject)
  // Gowtham (2025AIDS001) - ~88%
  // Kavya (2025AIDS002) - ~94%
  const students2025 = createdStudents.filter(s => s.batchYear === '2025-29');
  for (const date of dates) {
    const markedBy = facultyUser2.id; // Priya teaches DSA
    for (const student of students2025) {
      const status = Math.random() < (student.rollNo === '2025AIDS001' ? 0.88 : 0.94)
        ? Status.PRESENT
        : Status.ABSENT;

      await prisma.attendance.create({
        data: {
          studentId: student.id,
          subjectId: dsaSubject.id,
          date: date,
          status: status,
          markedById: markedBy,
        },
      });
    }
  }

  console.log('Created Attendance records.');

  // 6. Create Marks
  // Marks for Batch 2024-28
  const examTypes = [ExamType.INTERNAL1, ExamType.INTERNAL2, ExamType.SEMESTER];
  for (const student of students2024) {
    for (const subject of subjects2024) {
      // Internal 1 (out of 50)
      await prisma.mark.create({
        data: {
          studentId: student.id,
          subjectId: subject.id,
          examType: ExamType.INTERNAL1,
          maxMarks: 50,
          marksObtained: Math.round(30 + Math.random() * 18),
        },
      });

      // Internal 2 (out of 50)
      await prisma.mark.create({
        data: {
          studentId: student.id,
          subjectId: subject.id,
          examType: ExamType.INTERNAL2,
          maxMarks: 50,
          marksObtained: Math.round(28 + Math.random() * 20),
        },
      });

      // Semester (out of 100)
      await prisma.mark.create({
        data: {
          studentId: student.id,
          subjectId: subject.id,
          examType: ExamType.SEMESTER,
          maxMarks: 100,
          marksObtained: Math.round(60 + Math.random() * 35),
        },
      });
    }
  }

  // Marks for Batch 2025-29 (DSA)
  for (const student of students2025) {
    await prisma.mark.create({
      data: {
        studentId: student.id,
        subjectId: dsaSubject.id,
        examType: ExamType.INTERNAL1,
        maxMarks: 50,
        marksObtained: Math.round(32 + Math.random() * 16),
      },
    });

    await prisma.mark.create({
      data: {
        studentId: student.id,
        subjectId: dsaSubject.id,
        examType: ExamType.INTERNAL2,
        maxMarks: 50,
        marksObtained: Math.round(30 + Math.random() * 18),
      },
    });

    await prisma.mark.create({
      data: {
        studentId: student.id,
        subjectId: dsaSubject.id,
        examType: ExamType.SEMESTER,
        maxMarks: 100,
        marksObtained: Math.round(65 + Math.random() * 30),
      },
    });
  }

  console.log('Created Marks records.');

  // 7. Create Low Attendance Notification for Abishek (who has below 75% attendance)
  const lowAttendanceStudent = createdStudents.find(s => s.rollNo === '2024AIDS002');
  if (lowAttendanceStudent) {
     await prisma.notification.create({
       data: {
         userId: lowAttendanceStudent.userId,
         title: 'Low Attendance Warning',
         message: 'Your overall attendance is 72.2%, which is below the minimum required threshold of 75.0%. Please contact your class advisor.',
         type: 'ATTENDANCE_WARNING',
         createdAt: new Date(),
         readStatus: false,
       },
     });
    console.log('Created Low-Attendance Notification.');
  }

  console.log('Database seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
