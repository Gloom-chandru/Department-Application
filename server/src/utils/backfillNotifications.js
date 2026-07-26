import prisma from './db.js';

export const runBackfill = async () => {
  console.log('--- STARTING NOTIFICATION BACKFILL ---');
  
  // 1. Pre-backfill metrics
  const totalBefore = await prisma.notification.count();
  
  // Check if studentId is queryable in the current schema
  let hasStudentId = false;
  try {
    await prisma.notification.count({
      where: { studentId: { not: null } }
    });
    hasStudentId = true;
  } catch (e) {
    hasStudentId = false;
  }

  if (!hasStudentId) {
    console.log('Schema contraction completed. Backfill skipped.');
    return {
      totalBefore,
      studentIdCountBefore: 0,
      userIdCountBefore: totalBefore,
      totalAfter: totalBefore,
      userIdCountAfter: totalBefore,
      orphanedCount: 0
    };
  }

  const studentIdCountBefore = await prisma.notification.count({
    where: { studentId: { not: null } }
  });
  const userIdCountBefore = await prisma.notification.count({
    where: { userId: { not: null } }
  });

  console.log(`Pre-backfill Metrics:`);
  console.log(`- Total notifications: ${totalBefore}`);
  console.log(`- Notifications with studentId: ${studentIdCountBefore}`);
  console.log(`- Notifications with userId: ${userIdCountBefore}`);

  // 2. Fetch all notifications needing backfill
  const notificationsToBackfill = await prisma.notification.findMany({
    where: {
      studentId: { not: null },
      userId: null
    }
  });

  console.log(`Found ${notificationsToBackfill.length} notifications to backfill.`);

  let successCount = 0;
  let errorCount = 0;

  for (const notif of notificationsToBackfill) {
    try {
      // Find the student profile to retrieve userId
      const student = await prisma.student.findUnique({
        where: { id: notif.studentId },
        select: { userId: true }
      });

      if (!student || !student.userId) {
        console.error(`ERROR: Student profile not found or missing userId for studentId ${notif.studentId} on notification ${notif.id}`);
        errorCount++;
        continue;
      }

      // Update the notification
      await prisma.notification.update({
        where: { id: notif.id },
        data: {
          userId: student.userId,
          title: notif.title || 'Attendance Alert'
        }
      });
      successCount++;
    } catch (err) {
      console.error(`ERROR backfilling notification ${notif.id}:`, err);
      errorCount++;
    }
  }

  // 3. Post-backfill metrics
  const totalAfter = await prisma.notification.count();
  const userIdCountAfter = await prisma.notification.count({
    where: { userId: { not: null } }
  });
  const orphanedCount = await prisma.notification.count({
    where: {
      studentId: { not: null },
      userId: null
    }
  });

  console.log(`Post-backfill Metrics:`);
  console.log(`- Total notifications: ${totalAfter}`);
  console.log(`- Notifications with userId: ${userIdCountAfter}`);
  console.log(`- Orphaned notifications (studentId set but userId null): ${orphanedCount}`);
  console.log(`- Successful maps: ${successCount}`);
  console.log(`- Errors: ${errorCount}`);

  if (orphanedCount > 0 || errorCount > 0) {
    throw new Error('Backfill failed: Some notifications could not be mapped to a valid userId.');
  }

  if (totalBefore !== totalAfter) {
    throw new Error(`Backfill failed: Row count mismatch! Before: ${totalBefore}, After: ${totalAfter}`);
  }

  console.log('--- NOTIFICATION BACKFILL COMPLETED SUCCESSFULLY ---');
  return {
    totalBefore,
    studentIdCountBefore,
    userIdCountBefore,
    totalAfter,
    userIdCountAfter,
    orphanedCount
  };
};
