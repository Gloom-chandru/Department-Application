import prisma from '../utils/db.js';
import { z } from 'zod';

const auditQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default('25'),
  action: z.string().optional(),
  entityType: z.string().optional(),
  actorUserId: z.string().optional(),
  // Support both full datetime strings and plain dates
  startDate: z.string().datetime({ precision: 3 }).or(z.string().date()).optional(),
  endDate: z.string().datetime({ precision: 3 }).or(z.string().date()).optional(),
  search: z.string().optional(),
});

/**
 * Retrieves a list of paginated audit log entries matching filters.
 */
export const getAuditLogs = async (req, res) => {
  try {
    const validation = auditQuerySchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        message: 'Invalid query parameters',
        errors: validation.error.format()
      });
    }

    let { page, limit, action, entityType, actorUserId, startDate, endDate, search } = validation.data;

    // Enforce limit protection (Cap at 100)
    if (limit > 100) {
      limit = 100;
    }

    const skip = (page - 1) * limit;

    // Build conditions
    const where = {};

    if (action) {
      where.action = action;
    }
    if (entityType) {
      where.entityType = entityType;
    }
    if (actorUserId) {
      where.actorUserId = actorUserId;
    }

    // Date range filter
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = new Date(startDate);
      }
      if (endDate) {
        where.timestamp.lte = new Date(endDate);
      }
    }

    // Text search over actor role, api route, and user name
    if (search) {
      where.OR = [
        { actorRole: { contains: search, mode: 'insensitive' } },
        { apiRoute: { contains: search, mode: 'insensitive' } },
        { actorUser: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          actorUser: {
            select: {
              name: true,
              email: true,
            }
          }
        },
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ message: 'Server error retrieving audit logs' });
  }
};

/**
 * Retrieves details for a single audit log entry.
 */
export const getAuditLogDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const log = await prisma.auditLog.findUnique({
      where: { id },
      include: {
        actorUser: {
          select: {
            name: true,
            email: true,
          }
        }
      }
    });

    if (!log) {
      return res.status(404).json({ message: 'Audit log record not found' });
    }

    res.json(log);
  } catch (error) {
    console.error('Error fetching audit log details:', error);
    res.status(500).json({ message: 'Server error retrieving audit log details' });
  }
};
