import { PrismaClient, Role, Status, ExamType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();
const prisma = new PrismaClient();

const FIRST_NAMES = [
  'Santhosh', 'Abishek', 'Deepika', 'Gowtham', 'Kavya', 'Rohith', 'Priya', 'Kiran',
  'Madhav', 'Sneha', 'Rahul', 'Ananya', 'Varun', 'Meera', 'Arjun', 'Pooja', 'Karthik',
  'Divya', 'Manoj', 'Swathi', 'Ganesh', 'Lakshmi', 'Dinesh', 'Sindhu', 'Praveen',
  'Keerthana', 'Suresh', 'Anjali', 'Mohan', 'Nithya', 'Ramesh', 'Sowmya', 'Vijay',
  'Hari', 'Thanu', 'Kumar', 'Rani', 'Ashok', 'Kavitha', 'Santhosh', 'Bharath', 'Lekshmi',
];

const LAST_NAMES = [
  'Kumar', 'R', 'S', 'V', 'B', 'C', 'D', 'Reddy', 'Rao', 'Pillai',
  'Naidu', 'Verma', 'Mehta', 'Patel', 'Singh', 'Yadav', 'Chandra',
];

const SECTIONS = ['A', 'B', 'C', 'D'];
const BATCHES = ['2023-27', '2024-28', '2025-29', '2022-26'];
const SUBJECT_NAMES = ['Machine Learning', 'Data Structures', 'Database Systems', 'Python Programming', 'Cloud Computing', 'Web Development'];
const SUBJECT_CODES = ['AD401', 'AD201', 'AD301', 'AD101', 'AD501', 'AD302'];
const DEPARTMENTS = [
  { name: 'Artificial Intelligence and Data Science', code: 'AIDS' },
  { name: 'Computer Science and Engineering', code: 'CSE' },
  { name: 'Information Technology', code: 'IT' },
  { name: 'Electronics and Communication Engineering', code: 'ECE' },
];

function generateStudent(index) {
  const firstName = FIRST_NAMES[index % FIRST_NAMES.length];
  const lastName = LAST_NAMES[Math.floor(index / FIRST_NAMES.length) % LAST_NAMES.length];
  const firstNameInitial = firstName.charAt(0).toLowerCase();
  const lastNameInitial = lastName.charAt(0).toLowerCase();
  const rollNum = String(1001 + index).padStart(4, '0');

  // Determine batch and section
  const batchIdx = Math.floor(index / 125) % BATCHES.length;
  const section = SECTIONS[Math.floor(index % 4)];

  // Pick department based on index
  const deptIdx = Math.floor(index / 125) % DEPARTMENTS.length;

  // Email
  const email = `${firstNameInitial}${lastNameInitial}${rollNum}@student.velammal.edu.in`;

  // CGPA - random between 6.0 and 9.8
  const cgpa = (6.0 + Math.random() * 3.8).toFixed(2);

  // Backlogs - mostly 0, some 1-3
  const backlogs = Math.random() < 0.7 ? 0 : Math.floor(Math.random() * 3) + 1;

  return {
    name: `${firstName} ${lastName}`,
    email,
    rollNo: `${BATCHES[batchIdx].substring(0, 4)}AIDS${rollNum}`,
    batchYear: BATCHES[batchIdx],
    section,
    mobileNo: `98765${String(4000 + index).padStart(4, '0')}`,
    guardianContact: `98765${String(5000 + index).padStart(4, '0')}`,
    cgpa: parseFloat(cgpa),
    currentBacklogs: backlogs,
    departmentCode: DEPARTMENTS[deptIdx].code,
    departmentName: DEPARTMENTS[deptIdx].name,
  };
}

async function main() {
  console.log('Starting seed of 500 duplicate students...');

  // Get or create departments
  const deptMap = {};
  for (const dept of DEPARTMENTS) {
    let d = await prisma.department.findUnique({ where: { code: dept.code } });
    if (!d) {
      d = await prisma.department.create({
        data: { name: dept.name, code: dept.code },
      });
    }
    deptMap[dept.code] = d.id;
  }

  // Get existing faculty (for attendance markedBy and subject faculty)
  const faculty = await prisma.faculty.findMany({
    include: { user: true },
  });

  const facultyUsers = await prisma.user.findMany({
    where: { role: Role.FACULTY },
  });

  // Create subjects for each department if they don't exist
  const subjectMap = {};
  const subjectCodes = new Set();
  for (let i = 0; i < 6; i++) {
    const code = SUBJECT_CODES[i];
    subjectCodes.add(code);
  }

  const existingSubjects = await prisma.subject.findMany({
    where: { code: { in: [...subjectCodes] } },
    include: { department: true },
  });

  for (const subj of existingSubjects) {
    if (!subjectMap[subj.code]) {
      subjectMap[subj.code] = { id: subj.id, departmentId: subj.departmentId, facultyId: subj.facultyId };
    }
  }

  // Create subjects for departments that don't have them
  for (const deptCode of Object.keys(deptMap)) {
    const deptId = deptMap[deptCode];
    const facultyForDept = faculty.find(f => f.departmentId === deptId);
    const facultyUserId = facultyForDept ? facultyForDept.userId : facultyUsers[0]?.id;

    for (let i = 0; i < 6; i++) {
      const code = SUBJECT_CODES[i];
      if (!subjectMap[code] || subjectMap[code].departmentId !== deptId) {
        try {
          const subj = await prisma.subject.create({
            data: {
              name: SUBJECT_NAMES[i],
              code: `${code}_${deptCode}`,
              semester: (i % 4) + 1,
              departmentId: deptId,
              facultyId: facultyForDept ? facultyForDept.id : (faculty[0]?.id || facultyUsers[0]?.id),
            },
          });
          subjectMap[`${code}_${deptCode}`] = {
            id: subj.id,
            departmentId: deptId,
            facultyId: facultyForDept ? facultyForDept.id : null,
          };
        } catch (e) {
          // Subject might already exist, skip
        }
      }
    }
  }

  const passwordHash = await bcrypt.hash('password123', 10);

  const BATCH_SIZE = 50;
  let createdCount = 0;

  for (let i = 0; i < 500; i++) {
    const idx = i;
    const s = generateStudent(idx);

    const user = await prisma.user.create({
      data: {
        name: s.name,
        email: s.email,
        passwordHash,
        role: Role.STUDENT,
        departmentId: deptMap[s.departmentCode],
      },
    });

    const student = await prisma.student.create({
      data: {
        userId: user.id,
        rollNo: s.rollNo,
        batchYear: s.batchYear,
        section: s.section,
        mobileNo: s.mobileNo,
        guardianContact: s.guardianContact,
        departmentId: deptMap[s.departmentCode],
        cgpa: s.cgpa,
        currentBacklogs: s.currentBacklogs,
      },
    });

    // Generate attendance records (10 past class dates)
    const subjectEntries = Object.values(subjectMap).filter(sm => sm.departmentId === deptMap[s.departmentCode]);
    const dates = [];
    let current = new Date('2026-07-01');
    for (let d = 0; d < 10; d++) {
      current.setDate(current.getDate() + 1);
      const day = current.getDay();
      if (day !== 0 && day !== 6) dates.push(new Date(current));
    }

    for (const date of dates) {
      for (const subjectEntry of subjectEntries.slice(0, 3)) { // 3 subjects each
        const markedBy = facultyUsers.find(f => f.id !== user.id);
        const status = Math.random() < 0.85 ? Status.PRESENT : Status.ABSENT;
        await prisma.attendance.create({
          data: {
            studentId: student.id,
            subjectId: subjectEntry.id,
            date: date,
            status: status,
            markedById: markedBy ? markedBy.id : facultyUsers[0]?.id,
          },
        });
      }
    }

    // Generate marks for 3 subjects
    const examTypes = [ExamType.INTERNAL1, ExamType.INTERNAL2, ExamType.SEMESTER];
    for (const subjectEntry of subjectEntries.slice(0, 3)) {
      for (const examType of examTypes) {
        await prisma.mark.create({
          data: {
            studentId: student.id,
            subjectId: subjectEntry.id,
            examType: examType,
            maxMarks: examType === ExamType.SEMESTER ? 100 : 50,
            marksObtained: Math.round(examType === ExamType.SEMESTER
              ? 60 + Math.random() * 35
              : 25 + Math.random() * 20
            ),
          },
        });
      }
    }

    // Create a low attendance notification for some students
    if (Math.random() < 0.15) {
      await prisma.notification.create({
        data: {
          userId: user.id,
          title: 'Low Attendance Warning',
          message: `Your overall attendance is below the minimum required threshold of 75.0%. Please contact your class advisor.`,
          type: 'ATTENDANCE_WARNING',
          readStatus: Math.random() < 0.5,
        },
      });
    }

    createdCount++;
    if (createdCount % 100 === 0) {
      console.log(`Created ${createdCount}/500 students...`);
    }
  }

  console.log(`\n✅ Successfully created ${createdCount} student records with:`);
  console.log(`   - 500 User records`);
  console.log(`   - 500 Student profile records (with CGPA, backlogs, department, batch, section)`);
  console.log(`   - ~15,000 Attendance records (10 dates x 3 subjects per student)`);
  console.log(`   - ~15,000 Marks records (3 subjects x 3 exam types per student)`);
  console.log(`   - ~75 Low-attendance notifications`);
  console.log('\nDatabase seeding of 500 duplicate students completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
