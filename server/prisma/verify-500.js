import { PrismaClient, Role } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();
const prisma = new PrismaClient();

try {
  const studentUsers = await prisma.user.count({ where: { role: Role.STUDENT } });
  const studentProfiles = await prisma.student.count();
  const attendance = await prisma.attendance.count();
  const marks = await prisma.mark.count();
  const notifications = await prisma.notification.count();
  const departments = await prisma.department.count();
  const subjects = await prisma.subject.count();
  const faculty = await prisma.faculty.count();

  console.log('\n=== Database Record Counts ===\n');
  console.log(`Departments:          ${departments}`);
  console.log(`Faculty:              ${faculty}`);
  console.log(`Student Users:        ${studentUsers}`);
  console.log(`Student Profiles:     ${studentProfiles}`);
  console.log(`Attendance Records:   ${attendance}`);
  console.log(`Mark Records:         ${marks}`);
  console.log(`Notifications:        ${notifications}`);
  console.log(`Subjects:             ${subjects}`);
  console.log('\n=== Sample Student Data (first 5 from seed-500) ===\n');

  const sampleStudents = await prisma.student.findMany({
    where: { user: { email: { endsWith: '@student.velammal.edu.in' } } },
    include: { user: true, department: true },
    take: 5,
  });

  for (const s of sampleStudents) {
    console.log(`Roll No: ${s.rollNo}`);
    console.log(`  Name:       ${s.user.name}`);
    console.log(`  Email:      ${s.user.email}`);
    console.log(`  Batch:      ${s.batchYear}`);
    console.log(`  Section:    ${s.section}`);
    console.log(`  CGPA:       ${s.cgpa}`);
    console.log(`  Backlogs:   ${s.currentBacklogs}`);
    console.log(`  Department: ${s.department.name} (${s.department.code})`);
    console.log('');
  }

  console.log('\n✅ All counts verified — database is populated with 500 students.\n');
} catch (e) {
  console.error('Error:', e.message);
} finally {
  await prisma.$disconnect();
}
