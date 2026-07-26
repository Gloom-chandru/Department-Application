import prisma from '../utils/db.js';
import { z } from 'zod';
import { logAudit, AUDIT_ACTIONS } from '../utils/audit.js';
import { createManyNotifications, NOTIFICATION_TYPES, NOTIFICATION_PRIORITIES } from '../utils/notificationService.js';
import {
  validatePeriodRange,
  validateSubjectForSchedule,
  validateSlot,
  validateBulkSlots,
  validateForPublication,
  checkScheduleEffectiveDateOverlap
} from '../utils/timetableConflictService.js';

// ---- Zod Schemas ----

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const periodSchema = z.object({
  periodNumber: z.number().int().min(1).max(200),
  name: z.string().min(1).max(50),
  startTime: z.string().regex(timeRegex, 'Must be HH:mm format'),
  endTime: z.string().regex(timeRegex, 'Must be HH:mm format'),
  isBreak: z.boolean().optional().default(false)
});

const roomSchema = z.object({
  roomNo: z.string().min(1).max(20),
  name: z.string().max(100).optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  type: z.enum(['CLASSROOM', 'LAB', 'SEMINAR_HALL', 'OTHER']).optional().default('CLASSROOM'),
  capacity: z.number().int().positive().optional().nullable(),
  isActive: z.boolean().optional().default(true)
});

const scheduleSchema = z.object({
  departmentId: z.string().uuid(),
  batchYear: z.string().regex(/^\d{4}-\d{2,4}$/, 'Must be YYYY-YY or YYYY-YYYY format'),
  section: z.string().min(1).max(2).transform(v => v.toUpperCase()),
  semester: z.number().int().min(1).max(8),
  name: z.string().min(1).max(100),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional().nullable()
});

const slotSchema = z.object({
  subjectId: z.string().uuid(),
  dayOfWeek: z.number().int().min(1).max(6),
  startPeriodId: z.string().uuid(),
  endPeriodId: z.string().uuid(),
  roomId: z.string().uuid().optional().nullable()
});

// ---- Helper: Get current semester from Settings ----

async function getCurrentSemester() {
  const setting = await prisma.setting.findUnique({
    where: { key: 'current_semester' }
  });
  return setting ? parseInt(setting.value, 10) : null;
}

// ==================== PERIOD TEMPLATE CRUD ====================

export const getPeriods = async (req, res) => {
  try {
    const periods = await prisma.periodTemplate.findMany({
      orderBy: { periodNumber: 'asc' }
    });
    res.json(periods);
  } catch (error) {
    console.error('Error fetching periods:', error);
    res.status(500).json({ message: 'Server error fetching period templates.' });
  }
};

export const createPeriod = async (req, res) => {
  try {
    const data = periodSchema.parse(req.body);

    if (data.startTime >= data.endTime) {
      return res.status(400).json({ message: 'startTime must be before endTime.' });
    }

    // Check for overlapping time ranges with existing periods
    const existing = await prisma.periodTemplate.findMany({ orderBy: { periodNumber: 'asc' } });

    for (const ep of existing) {
      if (data.startTime < ep.endTime && data.endTime > ep.startTime) {
        return res.status(409).json({
          message: `Time range ${data.startTime}-${data.endTime} overlaps with existing period "${ep.name}" (${ep.startTime}-${ep.endTime}).`
        });
      }
    }

    const period = await prisma.periodTemplate.create({ data });
    res.status(201).json(period);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'A period with this number already exists.' });
    }
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error('Error creating period:', error);
    res.status(500).json({ message: 'Server error creating period template.' });
  }
};

export const updatePeriod = async (req, res) => {
  try {
    const { id } = req.params;
    const data = periodSchema.partial().parse(req.body);

    const existing = await prisma.periodTemplate.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Period template not found.' });

    const newStart = data.startTime || existing.startTime;
    const newEnd = data.endTime || existing.endTime;
    if (newStart >= newEnd) {
      return res.status(400).json({ message: 'startTime must be before endTime.' });
    }

    // If changing to break, check no slots reference this period
    if (data.isBreak === true && !existing.isBreak) {
      const referencingSlots = await prisma.timetableSlot.findFirst({
        where: {
          OR: [
            { startPeriodId: id },
            { endPeriodId: id }
          ]
        }
      });
      if (referencingSlots) {
        return res.status(409).json({ message: 'Cannot mark period as break: timetable slots reference it.' });
      }
    }

    // Check time overlap with other periods
    const others = await prisma.periodTemplate.findMany({
      where: { NOT: { id } },
      orderBy: { periodNumber: 'asc' }
    });
    for (const ep of others) {
      if (newStart < ep.endTime && newEnd > ep.startTime) {
        return res.status(409).json({
          message: `Time range ${newStart}-${newEnd} overlaps with existing period "${ep.name}" (${ep.startTime}-${ep.endTime}).`
        });
      }
    }

    const updated = await prisma.periodTemplate.update({ where: { id }, data });
    res.json(updated);
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error('Error updating period:', error);
    res.status(500).json({ message: 'Server error updating period template.' });
  }
};

export const deletePeriod = async (req, res) => {
  try {
    const { id } = req.params;

    const referencingSlot = await prisma.timetableSlot.findFirst({
      where: { OR: [{ startPeriodId: id }, { endPeriodId: id }] }
    });
    if (referencingSlot) {
      return res.status(409).json({ message: 'Cannot delete period: timetable slots reference it.' });
    }

    await prisma.periodTemplate.delete({ where: { id } });
    res.json({ message: 'Period template deleted.' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Period template not found.' });
    }
    console.error('Error deleting period:', error);
    res.status(500).json({ message: 'Server error deleting period template.' });
  }
};

// ==================== ROOM CRUD ====================

export const getRooms = async (req, res) => {
  try {
    const { departmentId, type, isActive } = req.query;
    const where = {};
    if (departmentId) where.departmentId = departmentId;
    if (type) where.type = type;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const rooms = await prisma.room.findMany({
      where,
      include: { department: { select: { id: true, name: true, code: true } } },
      orderBy: { roomNo: 'asc' }
    });
    res.json(rooms);
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ message: 'Server error fetching rooms.' });
  }
};

export const createRoom = async (req, res) => {
  try {
    const data = roomSchema.parse(req.body);
    const room = await prisma.room.create({
      data,
      include: { department: { select: { id: true, name: true, code: true } } }
    });
    res.status(201).json(room);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'A room with this number already exists.' });
    }
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error('Error creating room:', error);
    res.status(500).json({ message: 'Server error creating room.' });
  }
};

export const updateRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const data = roomSchema.partial().parse(req.body);

    const room = await prisma.room.update({
      where: { id },
      data,
      include: { department: { select: { id: true, name: true, code: true } } }
    });
    res.json(room);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Room not found.' });
    }
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error('Error updating room:', error);
    res.status(500).json({ message: 'Server error updating room.' });
  }
};

export const deleteRoom = async (req, res) => {
  try {
    const { id } = req.params;

    const referencingSlot = await prisma.timetableSlot.findFirst({ where: { roomId: id } });
    if (referencingSlot) {
      return res.status(409).json({ message: 'Cannot delete room: timetable slots reference it.' });
    }

    await prisma.room.delete({ where: { id } });
    res.json({ message: 'Room deleted.' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Room not found.' });
    }
    console.error('Error deleting room:', error);
    res.status(500).json({ message: 'Server error deleting room.' });
  }
};

// ==================== SCHEDULE CRUD ====================

export const createSchedule = async (req, res) => {
  try {
    const data = scheduleSchema.parse(req.body);

    // Verify department exists
    const dept = await prisma.department.findUnique({ where: { id: data.departmentId } });
    if (!dept) return res.status(404).json({ message: 'Department not found.' });

    if (data.effectiveTo && data.effectiveFrom > data.effectiveTo) {
      return res.status(400).json({ message: 'effectiveFrom must be before effectiveTo.' });
    }

    const schedule = await prisma.$transaction(async (tx) => {
      const created = await tx.timetableSchedule.create({
        data: {
          departmentId: data.departmentId,
          batchYear: data.batchYear,
          section: data.section,
          semester: data.semester,
          name: data.name,
          effectiveFrom: data.effectiveFrom + 'T00:00:00.000Z',
          effectiveTo: data.effectiveTo ? data.effectiveTo + 'T00:00:00.000Z' : null,
          status: 'DRAFT',
          createdByUserId: req.user.id
        }
      });

      await logAudit({
        actorUserId: req.user.id,
        actorRole: req.user.role,
        action: AUDIT_ACTIONS.TIMETABLE_SCHEDULE_CREATED,
        entityType: 'TimetableSchedule',
        entityId: created.id,
        newValue: { name: data.name, department: dept.code, batchYear: data.batchYear, section: data.section, semester: data.semester },
        req
      }, tx);

      return created;
    });

    res.status(201).json(schedule);
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error('Error creating schedule:', error);
    res.status(500).json({ message: 'Server error creating schedule.' });
  }
};

export const getSchedules = async (req, res) => {
  try {
    const { departmentId, batchYear, section, semester, status } = req.query;
    const where = {};
    if (departmentId) where.departmentId = departmentId;
    if (batchYear) where.batchYear = batchYear;
    if (section) where.section = section.toUpperCase();
    if (semester) where.semester = parseInt(semester, 10);
    if (status) where.status = status;

    const schedules = await prisma.timetableSchedule.findMany({
      where,
      include: {
        department: { select: { id: true, name: true, code: true } },
        _count: { select: { slots: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(schedules);
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ message: 'Server error fetching schedules.' });
  }
};

export const getScheduleDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const schedule = await prisma.timetableSchedule.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true, code: true } },
        slots: {
          include: {
            subject: { select: { id: true, name: true, code: true, faculty: { select: { id: true, user: { select: { name: true } } } } } },
            startPeriod: true,
            endPeriod: true,
            room: { select: { id: true, roomNo: true, name: true, type: true } }
          },
          orderBy: [{ dayOfWeek: 'asc' }, { startPeriod: { periodNumber: 'asc' } }]
        }
      }
    });

    if (!schedule) return res.status(404).json({ message: 'Schedule not found.' });
    res.json(schedule);
  } catch (error) {
    console.error('Error fetching schedule details:', error);
    res.status(500).json({ message: 'Server error fetching schedule details.' });
  }
};

export const updateSchedule = async (req, res) => {
  try {
    const { id } = req.params;

    const schedule = await prisma.timetableSchedule.findUnique({ where: { id } });
    if (!schedule) return res.status(404).json({ message: 'Schedule not found.' });
    if (schedule.status !== 'DRAFT') {
      return res.status(400).json({ message: 'Only DRAFT schedules can be edited.' });
    }

    const allowed = z.object({
      name: z.string().min(1).max(100).optional(),
      effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable()
    }).parse(req.body);

    const updateData = {};
    if (allowed.name) updateData.name = allowed.name;
    if (allowed.effectiveFrom) updateData.effectiveFrom = allowed.effectiveFrom + 'T00:00:00.000Z';
    if (allowed.effectiveTo !== undefined) {
      updateData.effectiveTo = allowed.effectiveTo ? allowed.effectiveTo + 'T00:00:00.000Z' : null;
    }

    const updated = await prisma.timetableSchedule.update({ where: { id }, data: updateData });
    res.json(updated);
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error('Error updating schedule:', error);
    res.status(500).json({ message: 'Server error updating schedule.' });
  }
};

export const publishSchedule = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await prisma.$transaction(async (tx) => {
      const schedule = await tx.timetableSchedule.findUnique({
        where: { id },
        include: { department: true }
      });
      if (!schedule) throw new Error('NOT_FOUND');
      if (schedule.status !== 'DRAFT') throw new Error('INVALID_STATUS');

      // Full conflict validation
      const validation = await validateForPublication(tx, schedule);
      if (!validation.valid) {
        return { success: false, errors: validation.errors };
      }

      // Update status
      await tx.timetableSchedule.update({
        where: { id },
        data: { status: 'PUBLISHED' }
      });

      // Notify affected students
      const students = await tx.student.findMany({
        where: {
          departmentId: schedule.departmentId,
          batchYear: schedule.batchYear,
          section: schedule.section
        },
        select: { userId: true }
      });

      if (students.length > 0) {
        const studentNotifs = students.map(s => ({
          userId: s.userId,
          title: 'Timetable Published',
          message: `A new timetable schedule "${schedule.name}" for Semester ${schedule.semester} has been published.`,
          type: NOTIFICATION_TYPES.TIMETABLE_CHANGED,
          priority: NOTIFICATION_PRIORITIES.NORMAL,
          relatedEntityType: 'TimetableSchedule',
          relatedEntityId: schedule.id
        }));
        await createManyNotifications(studentNotifs, tx);
      }

      // Notify affected faculty
      const slots = await tx.timetableSlot.findMany({
        where: { scheduleId: id },
        include: { subject: { select: { facultyId: true, faculty: { select: { userId: true } } } } }
      });

      const uniqueFacultyUserIds = [...new Set(slots.map(s => s.subject.faculty.userId))];
      if (uniqueFacultyUserIds.length > 0) {
        const facultyNotifs = uniqueFacultyUserIds.map(uid => ({
          userId: uid,
          title: 'Teaching Schedule Published',
          message: `A timetable schedule "${schedule.name}" (${schedule.department.code} ${schedule.batchYear}-${schedule.section}, Sem ${schedule.semester}) has been published affecting your teaching schedule.`,
          type: NOTIFICATION_TYPES.TIMETABLE_CHANGED,
          priority: NOTIFICATION_PRIORITIES.NORMAL,
          relatedEntityType: 'TimetableSchedule',
          relatedEntityId: schedule.id
        }));
        await createManyNotifications(facultyNotifs, tx);
      }

      // Audit log
      await logAudit({
        actorUserId: req.user.id,
        actorRole: req.user.role,
        action: AUDIT_ACTIONS.TIMETABLE_PUBLISHED,
        entityType: 'TimetableSchedule',
        entityId: id,
        newValue: { name: schedule.name, slotsCount: slots.length, studentsNotified: students.length, facultyNotified: uniqueFacultyUserIds.length },
        req
      }, tx);

      return { success: true };
    });

    if (result.success === false) {
      return res.status(409).json({ message: 'Schedule has conflicts and cannot be published.', conflicts: result.errors });
    }

    res.json({ message: 'Schedule published successfully.' });
  } catch (error) {
    if (error.message === 'NOT_FOUND') return res.status(404).json({ message: 'Schedule not found.' });
    if (error.message === 'INVALID_STATUS') return res.status(400).json({ message: 'Only DRAFT schedules can be published.' });
    console.error('Error publishing schedule:', error);
    res.status(500).json({ message: 'Server error publishing schedule.' });
  }
};

export const archiveSchedule = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.$transaction(async (tx) => {
      const schedule = await tx.timetableSchedule.findUnique({ where: { id } });
      if (!schedule) throw new Error('NOT_FOUND');
      if (schedule.status !== 'PUBLISHED') throw new Error('INVALID_STATUS');

      await tx.timetableSchedule.update({
        where: { id },
        data: { status: 'ARCHIVED' }
      });

      await logAudit({
        actorUserId: req.user.id,
        actorRole: req.user.role,
        action: AUDIT_ACTIONS.TIMETABLE_ARCHIVED,
        entityType: 'TimetableSchedule',
        entityId: id,
        newValue: { name: schedule.name },
        req
      }, tx);
    });

    res.json({ message: 'Schedule archived successfully.' });
  } catch (error) {
    if (error.message === 'NOT_FOUND') return res.status(404).json({ message: 'Schedule not found.' });
    if (error.message === 'INVALID_STATUS') return res.status(400).json({ message: 'Only PUBLISHED schedules can be archived.' });
    console.error('Error archiving schedule:', error);
    res.status(500).json({ message: 'Server error archiving schedule.' });
  }
};

// ==================== SLOT CRUD ====================

export const createSlot = async (req, res) => {
  try {
    const { id: scheduleId } = req.params;
    const data = slotSchema.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      const schedule = await tx.timetableSchedule.findUnique({ where: { id: scheduleId } });
      if (!schedule) throw new Error('NOT_FOUND');
      if (schedule.status !== 'DRAFT') throw new Error('DRAFT_ONLY');

      const validation = await validateSlot(tx, data, schedule);
      if (!validation.valid) {
        return { success: false, errors: validation.errors };
      }

      const slot = await tx.timetableSlot.create({
        data: {
          scheduleId,
          subjectId: data.subjectId,
          dayOfWeek: data.dayOfWeek,
          startPeriodId: data.startPeriodId,
          endPeriodId: data.endPeriodId,
          roomId: data.roomId || null
        },
        include: {
          subject: { select: { name: true, code: true } },
          startPeriod: true,
          endPeriod: true,
          room: { select: { roomNo: true } }
        }
      });

      await logAudit({
        actorUserId: req.user.id,
        actorRole: req.user.role,
        action: AUDIT_ACTIONS.TIMETABLE_SLOT_CREATED,
        entityType: 'TimetableSlot',
        entityId: slot.id,
        newValue: { subject: slot.subject.code, dayOfWeek: data.dayOfWeek, periods: validation.occupiedPeriodNumbers },
        req
      }, tx);

      return { success: true, slot };
    });

    if (result.success === false) {
      return res.status(409).json({ message: 'Slot validation failed.', errors: result.errors });
    }

    res.status(201).json(result.slot);
  } catch (error) {
    if (error.message === 'NOT_FOUND') return res.status(404).json({ message: 'Schedule not found.' });
    if (error.message === 'DRAFT_ONLY') return res.status(400).json({ message: 'Slots can only be added to DRAFT schedules.' });
    if (error.name === 'ZodError') return res.status(400).json({ message: error.errors[0].message });
    if (error.code === 'P2002') return res.status(409).json({ message: 'A slot already exists at this day and period in this schedule.' });
    console.error('Error creating slot:', error);
    res.status(500).json({ message: 'Server error creating slot.' });
  }
};

export const bulkCreateSlots = async (req, res) => {
  try {
    const { id: scheduleId } = req.params;
    const { slots: slotsInput } = req.body;

    if (!Array.isArray(slotsInput) || slotsInput.length === 0) {
      return res.status(400).json({ message: 'slots must be a non-empty array.' });
    }

    // Parse each slot
    const parsedSlots = [];
    for (let i = 0; i < slotsInput.length; i++) {
      try {
        parsedSlots.push(slotSchema.parse(slotsInput[i]));
      } catch (err) {
        return res.status(400).json({ message: `Slot ${i + 1}: ${err.errors?.[0]?.message || 'Invalid data.'}` });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const schedule = await tx.timetableSchedule.findUnique({ where: { id: scheduleId } });
      if (!schedule) throw new Error('NOT_FOUND');
      if (schedule.status !== 'DRAFT') throw new Error('DRAFT_ONLY');

      const validation = await validateBulkSlots(tx, parsedSlots, schedule);
      if (!validation.valid) {
        return { success: false, errors: validation.errors };
      }

      // Create all slots
      const created = [];
      for (const slot of parsedSlots) {
        const s = await tx.timetableSlot.create({
          data: {
            scheduleId,
            subjectId: slot.subjectId,
            dayOfWeek: slot.dayOfWeek,
            startPeriodId: slot.startPeriodId,
            endPeriodId: slot.endPeriodId,
            roomId: slot.roomId || null
          }
        });
        created.push(s);
      }

      await logAudit({
        actorUserId: req.user.id,
        actorRole: req.user.role,
        action: AUDIT_ACTIONS.TIMETABLE_SLOT_CREATED,
        entityType: 'TimetableSlot',
        entityId: scheduleId,
        newValue: { bulkCount: created.length, scheduleId },
        req
      }, tx);

      return { success: true, count: created.length };
    });

    if (result.success === false) {
      return res.status(409).json({ message: 'Bulk creation failed due to conflicts.', conflicts: result.errors });
    }

    res.status(201).json({ message: `${result.count} slot(s) created successfully.` });
  } catch (error) {
    if (error.message === 'NOT_FOUND') return res.status(404).json({ message: 'Schedule not found.' });
    if (error.message === 'DRAFT_ONLY') return res.status(400).json({ message: 'Slots can only be added to DRAFT schedules.' });
    console.error('Error bulk creating slots:', error);
    res.status(500).json({ message: 'Server error in bulk slot creation.' });
  }
};

export const updateSlot = async (req, res) => {
  try {
    const { id } = req.params;
    const data = slotSchema.partial().parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.timetableSlot.findUnique({
        where: { id },
        include: { schedule: true }
      });
      if (!existing) throw new Error('NOT_FOUND');
      if (existing.schedule.status !== 'DRAFT') throw new Error('DRAFT_ONLY');

      const fullData = {
        subjectId: data.subjectId || existing.subjectId,
        dayOfWeek: data.dayOfWeek !== undefined ? data.dayOfWeek : existing.dayOfWeek,
        startPeriodId: data.startPeriodId || existing.startPeriodId,
        endPeriodId: data.endPeriodId || existing.endPeriodId,
        roomId: data.roomId !== undefined ? data.roomId : existing.roomId
      };

      const validation = await validateSlot(tx, fullData, existing.schedule, id);
      if (!validation.valid) {
        return { success: false, errors: validation.errors };
      }

      const updated = await tx.timetableSlot.update({
        where: { id },
        data: fullData,
        include: {
          subject: { select: { name: true, code: true } },
          startPeriod: true,
          endPeriod: true,
          room: { select: { roomNo: true } }
        }
      });

      await logAudit({
        actorUserId: req.user.id,
        actorRole: req.user.role,
        action: AUDIT_ACTIONS.TIMETABLE_SLOT_UPDATED,
        entityType: 'TimetableSlot',
        entityId: id,
        newValue: { subject: updated.subject.code, dayOfWeek: fullData.dayOfWeek },
        req
      }, tx);

      return { success: true, slot: updated };
    });

    if (result.success === false) {
      return res.status(409).json({ message: 'Slot update validation failed.', errors: result.errors });
    }

    res.json(result.slot);
  } catch (error) {
    if (error.message === 'NOT_FOUND') return res.status(404).json({ message: 'Slot not found.' });
    if (error.message === 'DRAFT_ONLY') return res.status(400).json({ message: 'Only slots in DRAFT schedules can be edited.' });
    if (error.name === 'ZodError') return res.status(400).json({ message: error.errors[0].message });
    console.error('Error updating slot:', error);
    res.status(500).json({ message: 'Server error updating slot.' });
  }
};

export const deleteSlot = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.$transaction(async (tx) => {
      const slot = await tx.timetableSlot.findUnique({
        where: { id },
        include: { schedule: true, subject: { select: { code: true } } }
      });
      if (!slot) throw new Error('NOT_FOUND');
      if (slot.schedule.status !== 'DRAFT') throw new Error('DRAFT_ONLY');

      await tx.timetableSlot.delete({ where: { id } });

      await logAudit({
        actorUserId: req.user.id,
        actorRole: req.user.role,
        action: AUDIT_ACTIONS.TIMETABLE_SLOT_DELETED,
        entityType: 'TimetableSlot',
        entityId: id,
        previousValue: { subject: slot.subject.code, dayOfWeek: slot.dayOfWeek },
        req
      }, tx);
    });

    res.json({ message: 'Slot deleted.' });
  } catch (error) {
    if (error.message === 'NOT_FOUND') return res.status(404).json({ message: 'Slot not found.' });
    if (error.message === 'DRAFT_ONLY') return res.status(400).json({ message: 'Only slots in DRAFT schedules can be deleted.' });
    console.error('Error deleting slot:', error);
    res.status(500).json({ message: 'Server error deleting slot.' });
  }
};

// ==================== STUDENT VIEW ====================

export const getStudentTimetable = async (req, res) => {
  try {
    const student = await prisma.student.findUnique({
      where: { userId: req.user.id },
      select: { departmentId: true, batchYear: true, section: true }
    });
    if (!student) return res.status(404).json({ message: 'Student profile not found.' });

    let semester = req.query.semester ? parseInt(req.query.semester, 10) : null;
    if (!semester) {
      semester = await getCurrentSemester();
      if (!semester) return res.status(400).json({ message: 'No semester specified and no current semester configured.' });
    }
    if (semester < 1 || semester > 8) return res.status(400).json({ message: 'Semester must be between 1 and 8.' });

    // Find the active PUBLISHED schedule for this class group
    const now = new Date();
    const schedule = await prisma.timetableSchedule.findFirst({
      where: {
        departmentId: student.departmentId,
        batchYear: student.batchYear,
        section: student.section,
        semester,
        status: 'PUBLISHED',
        effectiveFrom: { lte: now },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: now } }
        ]
      },
      include: {
        slots: {
          include: {
            subject: { select: { id: true, name: true, code: true, faculty: { select: { user: { select: { name: true } } } } } },
            startPeriod: true,
            endPeriod: true,
            room: { select: { roomNo: true, name: true, type: true } }
          },
          orderBy: [{ dayOfWeek: 'asc' }, { startPeriod: { periodNumber: 'asc' } }]
        }
      }
    });

    // Also get all period templates for the grid
    const periods = await prisma.periodTemplate.findMany({ orderBy: { periodNumber: 'asc' } });

    res.json({
      schedule: schedule || null,
      slots: schedule?.slots || [],
      periods,
      semester
    });
  } catch (error) {
    console.error('Error fetching student timetable:', error);
    res.status(500).json({ message: 'Server error fetching timetable.' });
  }
};

// ==================== FACULTY VIEW ====================

export const getFacultyTimetable = async (req, res) => {
  try {
    const faculty = await prisma.faculty.findUnique({
      where: { userId: req.user.id },
      select: { id: true }
    });
    if (!faculty) return res.status(404).json({ message: 'Faculty profile not found.' });

    let semester = req.query.semester ? parseInt(req.query.semester, 10) : null;
    if (!semester) {
      semester = await getCurrentSemester();
    }

    const now = new Date();
    const whereSchedule = {
      status: 'PUBLISHED',
      effectiveFrom: { lte: now },
      OR: [
        { effectiveTo: null },
        { effectiveTo: { gte: now } }
      ]
    };
    if (semester) whereSchedule.semester = semester;

    const slots = await prisma.timetableSlot.findMany({
      where: {
        subject: { facultyId: faculty.id },
        schedule: whereSchedule
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        startPeriod: true,
        endPeriod: true,
        room: { select: { roomNo: true, name: true, type: true } },
        schedule: { select: { id: true, name: true, departmentId: true, batchYear: true, section: true, semester: true, department: { select: { code: true } } } }
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startPeriod: { periodNumber: 'asc' } }]
    });

    const periods = await prisma.periodTemplate.findMany({ orderBy: { periodNumber: 'asc' } });

    res.json({
      slots,
      periods,
      teachingLoad: slots.length
    });
  } catch (error) {
    console.error('Error fetching faculty timetable:', error);
    res.status(500).json({ message: 'Server error fetching faculty schedule.' });
  }
};
