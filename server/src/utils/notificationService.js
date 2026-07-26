import prisma from './db.js';

export const NOTIFICATION_TYPES = {
  ATTENDANCE_WARNING: 'ATTENDANCE_WARNING',
  MARKS_PUBLISHED: 'MARKS_PUBLISHED',
  ASSIGNMENT_CREATED: 'ASSIGNMENT_CREATED',
  ASSIGNMENT_DEADLINE: 'ASSIGNMENT_DEADLINE',
  LEAVE_STATUS: 'LEAVE_STATUS',
  OD_STATUS: 'OD_STATUS',
  TIMETABLE_CHANGED: 'TIMETABLE_CHANGED',
  ACADEMIC_RISK: 'ACADEMIC_RISK',
  ANNOUNCEMENT: 'ANNOUNCEMENT',
  PLACEMENT: 'PLACEMENT',
  SYSTEM: 'SYSTEM'
};

export const NOTIFICATION_PRIORITIES = {
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  URGENT: 'URGENT'
};

/**
 * Creates a single notification in-app record.
 * Takes an optional transaction client `tx` to participate in business transactions.
 */
export const createNotification = async ({
  userId,
  title,
  message,
  type,
  priority = 'NORMAL',
  relatedEntityType = null,
  relatedEntityId = null
}, tx = null) => {
  // Validate type and priority
  if (!Object.values(NOTIFICATION_TYPES).includes(type)) {
    throw new Error(`Invalid notification type: ${type}`);
  }
  if (!Object.values(NOTIFICATION_PRIORITIES).includes(priority)) {
    throw new Error(`Invalid notification priority: ${priority}`);
  }
  if (!userId) {
    throw new Error('userId is required to create a notification');
  }
  if (!title) {
    throw new Error('title is required to create a notification');
  }

  const client = tx || prisma;

  return await client.notification.create({
    data: {
      userId,
      title,
      message,
      type,
      priority,
      relatedEntityType,
      relatedEntityId,
      readStatus: false
    }
  });
};

/**
 * Creates multiple notification records in a batch.
 */
export const createManyNotifications = async (notifications, tx = null) => {
  const client = tx || prisma;

  // Validate all entries
  for (const notif of notifications) {
    if (!Object.values(NOTIFICATION_TYPES).includes(notif.type)) {
      throw new Error(`Invalid notification type: ${notif.type}`);
    }
    if (notif.priority && !Object.values(NOTIFICATION_PRIORITIES).includes(notif.priority)) {
      throw new Error(`Invalid notification priority: ${notif.priority}`);
    }
    if (!notif.userId) {
      throw new Error('userId is required for all batch notifications');
    }
    if (!notif.title) {
      throw new Error('title is required for all batch notifications');
    }
  }

  return await client.notification.createMany({
    data: notifications.map(n => ({
      userId: n.userId,
      title: n.title,
      message: n.message,
      type: n.type,
      priority: n.priority || 'NORMAL',
      relatedEntityType: n.relatedEntityType || null,
      relatedEntityId: n.relatedEntityId || null,
      readStatus: false
    }))
  });
};

/**
 * Marks a notification as read, ensuring the request scopes to the target user.
 */
export const markAsRead = async (notificationId, userId, tx = null) => {
  const client = tx || prisma;

  const result = await client.notification.updateMany({
    where: {
      id: notificationId,
      userId
    },
    data: {
      readStatus: true,
      readAt: new Date()
    }
  });

  if (result.count === 0) {
    throw new Error('Notification not found or access denied');
  }

  return result;
};

/**
 * Marks all notifications for a given user as read.
 */
export const markAllAsRead = async (userId, tx = null) => {
  const client = tx || prisma;

  return await client.notification.updateMany({
    where: {
      userId,
      readStatus: false
    },
    data: {
      readStatus: true,
      readAt: new Date()
    }
  });
};

/**
 * Archives a notification, ensuring the request scopes to the target user.
 */
export const archiveNotification = async (notificationId, userId, tx = null) => {
  const client = tx || prisma;

  const result = await client.notification.updateMany({
    where: {
      id: notificationId,
      userId
    },
    data: {
      archivedAt: new Date()
    }
  });

  if (result.count === 0) {
    throw new Error('Notification not found or access denied');
  }

  return result;
};
