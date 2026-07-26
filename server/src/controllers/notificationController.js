import prisma from '../utils/db.js';
import { z } from 'zod';
import * as notificationService from '../utils/notificationService.js';

const querySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default('25'),
  type: z.string().optional(),
  readStatus: z.enum(['true', 'false']).transform(val => val === 'true').optional(),
  includeArchived: z.enum(['true', 'false']).transform(val => val === 'true').optional().default('false')
});

/**
 * Retrieves paginated, filtered notifications for the logged-in user.
 */
export const getNotifications = async (req, res) => {
  try {
    const validation = querySchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        message: 'Invalid query parameters',
        errors: validation.error.format()
      });
    }

    let { page, limit, type, readStatus, includeArchived } = validation.data;

    // Enforce limits
    if (limit > 100) {
      limit = 100;
    }

    const skip = (page - 1) * limit;

    // Build conditions scoped to user
    const where = {
      userId: req.user.id
    };

    if (type) {
      where.type = type;
    }
    if (readStatus !== undefined) {
      where.readStatus = readStatus;
    }
    if (!includeArchived) {
      where.archivedAt = null;
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.notification.count({ where })
    ]);

    res.json({
      notifications,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Server error retrieving notifications' });
  }
};

/**
 * Fast unread count query for the header badge.
 */
export const getUnreadCount = async (req, res) => {
  try {
    const count = await prisma.notification.count({
      where: {
        userId: req.user.id,
        readStatus: false,
        archivedAt: null
      }
    });

    res.json({ count });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ message: 'Server error fetching unread count' });
  }
};

/**
 * Marks a notification as read (scopes ownership natively).
 */
export const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    await notificationService.markAsRead(id, req.user.id);
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification read:', error);
    if (error.message === 'Notification not found or access denied') {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error marking notification read' });
  }
};

/**
 * Marks all user's notifications as read.
 */
export const markAllNotificationsRead = async (req, res) => {
  try {
    await notificationService.markAllAsRead(req.user.id);
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications read:', error);
    res.status(500).json({ message: 'Server error marking all read' });
  }
};

/**
 * Archives a notification (scopes ownership natively).
 */
export const archiveNotification = async (req, res) => {
  try {
    const { id } = req.params;
    await notificationService.archiveNotification(id, req.user.id);
    res.json({ message: 'Notification archived successfully' });
  } catch (error) {
    console.error('Error archiving notification:', error);
    if (error.message === 'Notification not found or access denied') {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error archiving notification' });
  }
};
