/**
 * Timetable Conflict Validation Service
 *
 * Centralized validator used by single create, update, bulk create,
 * and schedule publication. Prevents inconsistent rules across endpoints.
 *
 * Validates: period ranges, subject-schedule matching, class-group conflicts,
 * faculty conflicts (cross-semester), room conflicts, and effective-date overlaps.
 */

/**
 * Resolves the array of period numbers occupied by a startPeriod→endPeriod range.
 * Rejects if any period in the range is a break.
 * Returns { occupiedPeriodNumbers: number[], periods: PeriodTemplate[] }
 */
export async function validatePeriodRange(tx, startPeriodId, endPeriodId) {
  const startPeriod = await tx.periodTemplate.findUnique({ where: { id: startPeriodId } });
  const endPeriod = await tx.periodTemplate.findUnique({ where: { id: endPeriodId } });

  if (!startPeriod) throw new Error('Start period template not found.');
  if (!endPeriod) throw new Error('End period template not found.');

  if (startPeriod.periodNumber > endPeriod.periodNumber) {
    throw new Error('Start period must be before or equal to end period.');
  }

  // Fetch all periods in the range
  const periodsInRange = await tx.periodTemplate.findMany({
    where: {
      periodNumber: {
        gte: startPeriod.periodNumber,
        lte: endPeriod.periodNumber
      }
    },
    orderBy: { periodNumber: 'asc' }
  });

  // Check for breaks in range
  const breakPeriods = periodsInRange.filter(p => p.isBreak);
  if (breakPeriods.length > 0) {
    const breakNames = breakPeriods.map(p => `${p.name} (Period ${p.periodNumber})`).join(', ');
    throw new Error(`Period range contains break period(s): ${breakNames}. Cannot schedule classes during breaks.`);
  }

  // Verify continuity — all period numbers in the range must exist
  const expectedCount = endPeriod.periodNumber - startPeriod.periodNumber + 1;
  if (periodsInRange.length !== expectedCount) {
    throw new Error('Period range is not contiguous. Some period numbers in the range are missing.');
  }

  return {
    occupiedPeriodNumbers: periodsInRange.map(p => p.periodNumber),
    periods: periodsInRange
  };
}

/**
 * Validates that a subject belongs to the correct department and semester.
 */
export async function validateSubjectForSchedule(tx, subjectId, schedule) {
  const subject = await tx.subject.findUnique({
    where: { id: subjectId },
    include: { faculty: true }
  });

  if (!subject) throw new Error('Subject not found.');

  if (subject.departmentId !== schedule.departmentId) {
    throw new Error(`Subject department mismatch: subject belongs to a different department than the schedule.`);
  }

  if (subject.semester !== schedule.semester) {
    throw new Error(`Subject semester mismatch: subject is for semester ${subject.semester} but schedule is for semester ${schedule.semester}.`);
  }

  return subject;
}

/**
 * Checks for class-group conflicts within the same schedule.
 * No two slots in the same schedule should overlap on the same day.
 */
export async function checkClassGroupConflict(tx, scheduleId, dayOfWeek, occupiedPeriodNumbers, excludeSlotId = null) {
  const existingSlots = await tx.timetableSlot.findMany({
    where: {
      scheduleId,
      dayOfWeek,
      ...(excludeSlotId ? { NOT: { id: excludeSlotId } } : {})
    },
    include: {
      startPeriod: true,
      endPeriod: true
    }
  });

  for (const slot of existingSlots) {
    const slotRange = [];
    for (let i = slot.startPeriod.periodNumber; i <= slot.endPeriod.periodNumber; i++) {
      slotRange.push(i);
    }

    const overlap = occupiedPeriodNumbers.some(p => slotRange.includes(p));
    if (overlap) {
      return {
        conflict: true,
        message: `Class group conflict: Day ${dayOfWeek}, periods ${occupiedPeriodNumbers.join(',')} overlap with existing slot (periods ${slotRange.join(',')}).`,
        conflictingSlot: slot
      };
    }
  }

  return { conflict: false };
}

/**
 * Checks for faculty conflicts ACROSS ALL schedules (cross-semester).
 * A faculty member cannot physically teach two classes at the same real time,
 * even if those classes belong to different semesters.
 *
 * Considers only PUBLISHED schedules (and the schedule being published)
 * with overlapping effective dates.
 */
export async function checkFacultyConflict(tx, facultyId, dayOfWeek, occupiedPeriodNumbers, scheduleId, effectiveFrom, effectiveTo, excludeSlotId = null) {
  // Find all PUBLISHED or same-schedule slots for this faculty on this day
  const allSlots = await tx.timetableSlot.findMany({
    where: {
      dayOfWeek,
      subject: { facultyId },
      NOT: {
        ...(excludeSlotId ? { id: excludeSlotId } : { id: undefined })
      },
      schedule: {
        OR: [
          { status: 'PUBLISHED' },
          { id: scheduleId }
        ]
      }
    },
    include: {
      startPeriod: true,
      endPeriod: true,
      schedule: true,
      subject: true
    }
  });

  for (const slot of allSlots) {
    // Skip slots from the same schedule (class-group conflict handles those)
    if (slot.scheduleId === scheduleId) continue;
    if (excludeSlotId && slot.id === excludeSlotId) continue;

    // Check effective date overlap between schedules
    const otherFrom = slot.schedule.effectiveFrom;
    const otherTo = slot.schedule.effectiveTo;

    if (!datesOverlap(effectiveFrom, effectiveTo, otherFrom, otherTo)) continue;

    // Check period overlap
    const slotRange = [];
    for (let i = slot.startPeriod.periodNumber; i <= slot.endPeriod.periodNumber; i++) {
      slotRange.push(i);
    }

    const overlap = occupiedPeriodNumbers.some(p => slotRange.includes(p));
    if (overlap) {
      return {
        conflict: true,
        message: `Faculty conflict: The faculty teaching ${slot.subject.code} is already scheduled on Day ${dayOfWeek}, periods ${slotRange.join(',')} in schedule "${slot.schedule.name}" (${slot.schedule.batchYear} ${slot.schedule.section}).`,
        conflictingSlot: slot
      };
    }
  }

  return { conflict: false };
}

/**
 * Checks for room conflicts ACROSS ALL schedules.
 * Same room cannot host two classes at the same time.
 */
export async function checkRoomConflict(tx, roomId, dayOfWeek, occupiedPeriodNumbers, scheduleId, effectiveFrom, effectiveTo, excludeSlotId = null) {
  if (!roomId) return { conflict: false };

  const allSlots = await tx.timetableSlot.findMany({
    where: {
      dayOfWeek,
      roomId,
      NOT: {
        ...(excludeSlotId ? { id: excludeSlotId } : { id: undefined })
      },
      schedule: {
        OR: [
          { status: 'PUBLISHED' },
          { id: scheduleId }
        ]
      }
    },
    include: {
      startPeriod: true,
      endPeriod: true,
      schedule: true,
      subject: true
    }
  });

  for (const slot of allSlots) {
    if (slot.scheduleId === scheduleId) continue;
    if (excludeSlotId && slot.id === excludeSlotId) continue;

    const otherFrom = slot.schedule.effectiveFrom;
    const otherTo = slot.schedule.effectiveTo;

    if (!datesOverlap(effectiveFrom, effectiveTo, otherFrom, otherTo)) continue;

    const slotRange = [];
    for (let i = slot.startPeriod.periodNumber; i <= slot.endPeriod.periodNumber; i++) {
      slotRange.push(i);
    }

    const overlap = occupiedPeriodNumbers.some(p => slotRange.includes(p));
    if (overlap) {
      return {
        conflict: true,
        message: `Room conflict: Room is already occupied on Day ${dayOfWeek}, periods ${slotRange.join(',')} by ${slot.subject.code} in schedule "${slot.schedule.name}".`,
        conflictingSlot: slot
      };
    }
  }

  return { conflict: false };
}

/**
 * Checks that no other PUBLISHED schedule for the same class group
 * has overlapping effective dates.
 */
export async function checkScheduleEffectiveDateOverlap(tx, schedule, excludeScheduleId = null) {
  const overlapping = await tx.timetableSchedule.findMany({
    where: {
      departmentId: schedule.departmentId,
      batchYear: schedule.batchYear,
      section: schedule.section,
      semester: schedule.semester,
      status: 'PUBLISHED',
      ...(excludeScheduleId ? { NOT: { id: excludeScheduleId } } : {})
    }
  });

  for (const existing of overlapping) {
    if (datesOverlap(schedule.effectiveFrom, schedule.effectiveTo, existing.effectiveFrom, existing.effectiveTo)) {
      return {
        conflict: true,
        message: `Schedule date overlap: Another published schedule "${existing.name}" (effective ${formatDate(existing.effectiveFrom)} to ${formatDate(existing.effectiveTo)}) overlaps with this schedule's effective dates.`,
        conflictingSchedule: existing
      };
    }
  }

  return { conflict: false };
}

/**
 * Full validation for a single slot.
 * Runs all conflict checks.
 */
export async function validateSlot(tx, slotData, schedule, excludeSlotId = null) {
  const errors = [];

  // 1. Period range
  let occupiedPeriodNumbers;
  try {
    const result = await validatePeriodRange(tx, slotData.startPeriodId, slotData.endPeriodId);
    occupiedPeriodNumbers = result.occupiedPeriodNumbers;
  } catch (err) {
    errors.push(err.message);
    return { valid: false, errors };
  }

  // 2. Subject validation
  let subject;
  try {
    subject = await validateSubjectForSchedule(tx, slotData.subjectId, schedule);
  } catch (err) {
    errors.push(err.message);
    return { valid: false, errors };
  }

  // 3. Class group conflict
  const classConflict = await checkClassGroupConflict(
    tx, schedule.id, slotData.dayOfWeek, occupiedPeriodNumbers, excludeSlotId
  );
  if (classConflict.conflict) errors.push(classConflict.message);

  // 4. Faculty conflict (cross-semester)
  const facultyConflict = await checkFacultyConflict(
    tx, subject.facultyId, slotData.dayOfWeek, occupiedPeriodNumbers,
    schedule.id, schedule.effectiveFrom, schedule.effectiveTo, excludeSlotId
  );
  if (facultyConflict.conflict) errors.push(facultyConflict.message);

  // 5. Room conflict
  if (slotData.roomId) {
    const roomConflict = await checkRoomConflict(
      tx, slotData.roomId, slotData.dayOfWeek, occupiedPeriodNumbers,
      schedule.id, schedule.effectiveFrom, schedule.effectiveTo, excludeSlotId
    );
    if (roomConflict.conflict) errors.push(roomConflict.message);
  }

  return {
    valid: errors.length === 0,
    errors,
    occupiedPeriodNumbers,
    subject
  };
}

/**
 * Validates multiple slots including internal payload conflicts.
 * Checks both against the DB and against other entries in the batch.
 */
export async function validateBulkSlots(tx, slotsData, schedule) {
  const allErrors = [];

  // Track internal occupancy for cross-checking within the payload
  // Key: `${dayOfWeek}` -> Set of occupied period numbers
  const internalOccupancy = {};
  // Key: `${facultyId}-${dayOfWeek}` -> Set of occupied period numbers
  const internalFacultyOccupancy = {};
  // Key: `${roomId}-${dayOfWeek}` -> Set of occupied period numbers
  const internalRoomOccupancy = {};

  for (let i = 0; i < slotsData.length; i++) {
    const slot = slotsData[i];
    const slotLabel = `Slot ${i + 1} (Day ${slot.dayOfWeek})`;

    // Validate against DB
    const result = await validateSlot(tx, slot, schedule);
    if (!result.valid) {
      allErrors.push({ index: i, label: slotLabel, errors: result.errors });
      continue;
    }

    const occupiedPeriods = result.occupiedPeriodNumbers;
    const dayKey = `${slot.dayOfWeek}`;

    // Check internal class-group conflict
    if (!internalOccupancy[dayKey]) internalOccupancy[dayKey] = new Set();
    const daySet = internalOccupancy[dayKey];
    const internalClassConflict = occupiedPeriods.some(p => daySet.has(p));
    if (internalClassConflict) {
      allErrors.push({
        index: i,
        label: slotLabel,
        errors: [`Internal batch conflict: Day ${slot.dayOfWeek} has overlapping period(s) within the submitted batch.`]
      });
      continue;
    }
    occupiedPeriods.forEach(p => daySet.add(p));

    // Check internal faculty conflict
    const facultyKey = `${result.subject.facultyId}-${slot.dayOfWeek}`;
    if (!internalFacultyOccupancy[facultyKey]) internalFacultyOccupancy[facultyKey] = new Set();
    const facultySet = internalFacultyOccupancy[facultyKey];
    const internalFacultyConflict = occupiedPeriods.some(p => facultySet.has(p));
    if (internalFacultyConflict) {
      allErrors.push({
        index: i,
        label: slotLabel,
        errors: [`Internal batch conflict: Faculty for ${result.subject.code} is already booked in this batch on Day ${slot.dayOfWeek} during overlapping period(s).`]
      });
      continue;
    }
    occupiedPeriods.forEach(p => facultySet.add(p));

    // Check internal room conflict
    if (slot.roomId) {
      const roomKey = `${slot.roomId}-${slot.dayOfWeek}`;
      if (!internalRoomOccupancy[roomKey]) internalRoomOccupancy[roomKey] = new Set();
      const roomSet = internalRoomOccupancy[roomKey];
      const internalRoomConflict = occupiedPeriods.some(p => roomSet.has(p));
      if (internalRoomConflict) {
        allErrors.push({
          index: i,
          label: slotLabel,
          errors: [`Internal batch conflict: Room is already booked in this batch on Day ${slot.dayOfWeek} during overlapping period(s).`]
        });
        continue;
      }
      occupiedPeriods.forEach(p => roomSet.add(p));
    }
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors
  };
}

/**
 * Full validation of all slots in a schedule before publishing.
 * Checks every slot for faculty/room conflicts against other published schedules.
 */
export async function validateForPublication(tx, schedule) {
  const slots = await tx.timetableSlot.findMany({
    where: { scheduleId: schedule.id },
    include: {
      startPeriod: true,
      endPeriod: true,
      subject: { include: { faculty: true } }
    }
  });

  if (slots.length === 0) {
    return { valid: false, errors: [{ label: 'Schedule', errors: ['Cannot publish an empty timetable schedule.'] }] };
  }

  const allErrors = [];

  for (const slot of slots) {
    const occupiedPeriodNumbers = [];
    for (let i = slot.startPeriod.periodNumber; i <= slot.endPeriod.periodNumber; i++) {
      occupiedPeriodNumbers.push(i);
    }

    // Faculty conflict (cross-schedule)
    const facultyConflict = await checkFacultyConflict(
      tx, slot.subject.facultyId, slot.dayOfWeek, occupiedPeriodNumbers,
      schedule.id, schedule.effectiveFrom, schedule.effectiveTo, slot.id
    );
    if (facultyConflict.conflict) {
      allErrors.push({
        label: `${slot.subject.code} Day ${slot.dayOfWeek} P${slot.startPeriod.periodNumber}${slot.startPeriod.periodNumber !== slot.endPeriod.periodNumber ? '-' + slot.endPeriod.periodNumber : ''}`,
        errors: [facultyConflict.message]
      });
    }

    // Room conflict (cross-schedule)
    if (slot.roomId) {
      const roomConflict = await checkRoomConflict(
        tx, slot.roomId, slot.dayOfWeek, occupiedPeriodNumbers,
        schedule.id, schedule.effectiveFrom, schedule.effectiveTo, slot.id
      );
      if (roomConflict.conflict) {
        allErrors.push({
          label: `${slot.subject.code} Day ${slot.dayOfWeek} P${slot.startPeriod.periodNumber}`,
          errors: [roomConflict.message]
        });
      }
    }
  }

  // Check schedule effective date overlap
  const dateOverlap = await checkScheduleEffectiveDateOverlap(tx, schedule, schedule.id);
  if (dateOverlap.conflict) {
    allErrors.push({ label: 'Schedule', errors: [dateOverlap.message] });
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors
  };
}


// ---- Utility Helpers ----

/**
 * Checks whether two date ranges overlap.
 * Null effectiveTo means open-ended (extends indefinitely).
 */
function datesOverlap(fromA, toA, fromB, toB) {
  const startA = new Date(fromA).getTime();
  const endA = toA ? new Date(toA).getTime() : Infinity;
  const startB = new Date(fromB).getTime();
  const endB = toB ? new Date(toB).getTime() : Infinity;

  return startA <= endB && startB <= endA;
}

function formatDate(d) {
  if (!d) return 'open-ended';
  return new Date(d).toISOString().split('T')[0];
}
