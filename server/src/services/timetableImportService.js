import prisma from '../utils/db.js';
import { z } from 'zod';
import { logAudit } from '../utils/audit.js';
import { validateBulkSlots } from '../utils/timetableConflictService.js';

const timetableRowSchema = z.object({
  subjectCode: z.string().min(1, 'Subject code is required').transform(v => v.toUpperCase()),
  dayOfWeek: z.coerce.number().int().min(1, 'Day of week must be between 1 and 6').max(6, 'Day of week must be between 1 and 6'),
  startPeriod: z.coerce.number().int().min(1, 'Start period must be greater than 0'),
  endPeriod: z.coerce.number().int().min(1, 'End period must be greater than 0'),
  roomNo: z.string().optional().nullable()
});

/**
 * Validates timetable spreadsheet data rows against a DRAFT schedule.
 * Maps codes/numbers to relational IDs first.
 */
export async function validateTimetableData(rows, scheduleId) {
  const errors = [];
  const mappedSlots = [];

  // Check schedule state
  const schedule = await prisma.timetableSchedule.findUnique({
    where: { id: scheduleId },
    include: { department: true }
  });

  if (!schedule) {
    throw new Error('Schedule not found.');
  }

  if (schedule.status !== 'DRAFT') {
    throw new Error('Timetable slots can only be imported into a DRAFT schedule.');
  }

  // Preload subjects
  const subjectsList = await prisma.subject.findMany({
    where: { departmentId: schedule.departmentId, semester: schedule.semester }
  });
  const subjectMap = new Map(subjectsList.map(s => [s.code.toUpperCase(), s.id]));

  // Preload periods
  const periodsList = await prisma.periodTemplate.findMany();
  const periodMap = new Map(periodsList.map(p => [p.periodNumber, p]));

  // Preload rooms
  const roomsList = await prisma.room.findMany();
  const roomMap = new Map(roomsList.map(r => [r.roomNo.toUpperCase(), r.id]));

  for (const row of rows) {
    const rowNum = row._rowNumber;

    // Zod parsing
    const parsed = timetableRowSchema.safeParse(row);
    if (!parsed.success) {
      parsed.error.errors.forEach(err => {
        errors.push({
          row: rowNum,
          column: err.path[0],
          code: 'VALIDATION_FAILED',
          message: err.message
        });
      });
      continue;
    }

    const { subjectCode, dayOfWeek, startPeriod, endPeriod, roomNo } = parsed.data;

    // Resolve subject ID
    const subjectId = subjectMap.get(subjectCode);
    if (!subjectId) {
      errors.push({
        row: rowNum,
        column: 'subjectCode',
        code: 'SUBJECT_NOT_FOUND',
        message: `Subject "${subjectCode}" not found in department "${schedule.department.code}" for semester ${schedule.semester}.`
      });
    }

    // Resolve start period template
    const startPeriodTemplate = periodMap.get(startPeriod);
    if (!startPeriodTemplate) {
      errors.push({
        row: rowNum,
        column: 'startPeriod',
        code: 'PERIOD_NOT_FOUND',
        message: `Period number ${startPeriod} not found.`
      });
    }

    // Resolve end period template
    const endPeriodTemplate = periodMap.get(endPeriod);
    if (!endPeriodTemplate) {
      errors.push({
        row: rowNum,
        column: 'endPeriod',
        code: 'PERIOD_NOT_FOUND',
        message: `Period number ${endPeriod} not found.`
      });
    }

    // Resolve room
    let roomId = null;
    if (roomNo) {
      roomId = roomMap.get(roomNo.toUpperCase());
      if (!roomId) {
        errors.push({
          row: rowNum,
          column: 'roomNo',
          code: 'ROOM_NOT_FOUND',
          message: `Room "${roomNo}" not found.`
        });
      }
    }

    if (errors.length === 0 || !errors.some(e => e.row === rowNum)) {
      mappedSlots.push({
        rowNum,
        subjectId,
        dayOfWeek,
        startPeriodId: startPeriodTemplate.id,
        endPeriodId: endPeriodTemplate.id,
        roomId
      });
    }
  }

  // If structurally valid, run conflict validation service checks
  if (errors.length === 0) {
    const conflictResult = await validateBulkSlots(prisma, mappedSlots, schedule);
    if (!conflictResult.valid) {
      // Map conflictResult errors to the dry-run error format
      conflictResult.errors.forEach(err => {
        const originalRow = mappedSlots[err.index]?.rowNum || 0;
        err.errors.forEach(msg => {
          errors.push({
            row: originalRow,
            column: 'All',
            code: 'CONFLICT_DETECTED',
            message: msg
          });
        });
      });
    }
  }

  return {
    valid: errors.length === 0,
    summary: {
      totalRows: rows.length,
      validRows: mappedSlots.length - (errors.length > 0 ? mappedSlots.length : 0),
      invalidRows: errors.length > 0 ? rows.length : 0
    },
    errors,
    data: mappedSlots
  };
}

/**
 * Persists validated slots atomically.
 */
export async function importTimetableConfirmed(scheduleId, validData, actorUser, req) {
  return await prisma.$transaction(async (tx) => {
    const createdSlots = [];

    for (const record of validData) {
      const slot = await tx.timetableSlot.create({
        data: {
          scheduleId,
          subjectId: record.subjectId,
          dayOfWeek: record.dayOfWeek,
          startPeriodId: record.startPeriodId,
          endPeriodId: record.endPeriodId,
          roomId: record.roomId
        }
      });
      createdSlots.push(slot);
    }

    // Log the bulk timetable import operation
    await logAudit({
      actorUserId: actorUser.id,
      actorRole: actorUser.role,
      action: 'BULK_TIMETABLE_IMPORT',
      entityType: 'TimetableSchedule',
      entityId: scheduleId,
      newValue: {
        slotsCount: createdSlots.length,
        scheduleId
      },
      req
    }, tx);

    return createdSlots;
  });
}
