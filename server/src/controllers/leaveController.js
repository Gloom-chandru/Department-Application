import prisma from '../utils/db.js';
import { z } from 'zod';
import storageAdapter from '../utils/storageService.js';
import { logAudit, AUDIT_ACTIONS } from '../utils/audit.js';
import { createNotification } from '../utils/notificationService.js';
import path from 'path';
import fs from 'fs';

// Schemas
export const requestCreateSchema = z.object({
  requestType: z.enum(['LEAVE', 'OD']),
  reason: z.string().min(10).max(500),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  reviewerFacultyId: z.string().uuid()
});

export const requestReviewSchema = z.object({
  remarks: z.string().max(500).optional()
});

export const requestRejectSchema = z.object({
  remarks: z.string().min(1, 'Remarks is required for rejection').max(500)
});

export const submitRequest = async (req, res) => {
  const studentId = req.user.studentId;
  if (!studentId) {
    return res.status(403).json({ message: 'Access denied: only students can submit Leave/OD requests.' });
  }

  const validation = requestCreateSchema.safeParse(req.body);
  if (!validation.success) {
    if (req.file) {
      try {
        await storageAdapter.deleteFile(
          req.body.requestType === 'OD' ? 'od' : 'leave',
          req.file.filename
        );
      } catch (err) {
        console.error('File cleanup failed', err);
      }
    }
    return res.status(400).json({ message: 'Validation failed', errors: validation.error.format() });
  }

  const { requestType, reason, startDate, endDate, reviewerFacultyId } = validation.data;

  // Validate dates
  if (startDate > endDate) {
    if (req.file) {
      try {
        await storageAdapter.deleteFile(
          requestType === 'OD' ? 'od' : 'leave',
          req.file.filename
        );
      } catch (err) {
        console.error('File cleanup failed', err);
      }
    }
    return res.status(400).json({ message: 'startDate cannot be after endDate.' });
  }

  // Future/present-date validation
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const requestStart = new Date(startDate + 'T00:00:00.000Z');

  if (requestStart < today) {
    if (req.file) {
      try {
        await storageAdapter.deleteFile(
          requestType === 'OD' ? 'od' : 'leave',
          req.file.filename
        );
      } catch (err) {
        console.error('File cleanup failed', err);
      }
    }
    return res.status(400).json({ message: 'Past-date requests are not allowed.' });
  }

  let fileSaved = null;
  if (req.file) {
    try {
      const originalFileName = req.file.originalname;
      const folderCategory = requestType === 'OD' ? 'od' : 'leave';
      fileSaved = await storageAdapter.saveFile(folderCategory, originalFileName, req.file.buffer);
    } catch (err) {
      console.error('File write failed', err);
      return res.status(500).json({ message: 'Failed to save uploaded file.' });
    }
  }

  try {
    const student = await prisma.student.findUnique({
      where: { id: studentId }
    });
    if (!student) {
      throw new Error('Student profile not found.');
    }

    const reviewer = await prisma.faculty.findUnique({
      where: { id: reviewerFacultyId }
    });
    if (!reviewer) {
      return res.status(400).json({ message: 'Reviewer faculty not found.' });
    }

    // Temporary reviewer-selection policy caused by current schema limitations.
    if (reviewer.departmentId !== student.departmentId) {
      return res.status(400).json({ message: 'Selected reviewer must belong to your department (Temporary reviewer-selection policy).' });
    }

    // Check date overlap for active requests (PENDING, APPROVED)
    const overlap = await prisma.leaveODRequest.findFirst({
      where: {
        studentId,
        status: { in: ['PENDING', 'APPROVED'] },
        OR: [
          {
            startDate: { lte: new Date(endDate + 'T00:00:00.000Z') },
            endDate: { gte: new Date(startDate + 'T00:00:00.000Z') }
          }
        ]
      }
    });

    if (overlap) {
      return res.status(400).json({ message: 'Overlap detected: you already have a pending or approved request covering these dates.' });
    }

    // Prisma transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create request
      const request = await tx.leaveODRequest.create({
        data: {
          studentId,
          requestType,
          reason,
          startDate: new Date(startDate + 'T00:00:00.000Z'),
          endDate: new Date(endDate + 'T00:00:00.000Z'),
          status: 'PENDING',
          attachmentPath: fileSaved,
          originalDocumentName: req.file ? req.file.originalname : null,
          reviewerFacultyId
        },
        include: { student: { include: { user: true } } }
      });

      // 2. Create SUBMITTED history event
      await tx.approvalHistory.create({
        data: {
          requestId: request.id,
          actorUserId: req.user.id,
          action: 'SUBMITTED',
          remarks: 'Request submitted'
        }
      });

      // 3. Notify Faculty
      await createNotification({
        userId: reviewer.userId,
        title: `New ${requestType} Request`,
        message: `Student ${request.student.user.name} submitted a new ${requestType} request.`,
        type: requestType === 'OD' ? 'OD_STATUS' : 'LEAVE_STATUS',
        priority: 'NORMAL',
        relatedEntityType: 'LeaveODRequest',
        relatedEntityId: request.id
      }, tx);

      return request;
    });

    // 4. Log Audit
    await logAudit({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: requestType === 'OD' ? AUDIT_ACTIONS.OD_REQUEST_SUBMITTED : AUDIT_ACTIONS.LEAVE_REQUEST_SUBMITTED,
      entityType: 'LeaveODRequest',
      entityId: result.id,
      newValue: {
        requestType: result.requestType,
        startDate: result.startDate,
        endDate: result.endDate,
        reviewerFacultyId: result.reviewerFacultyId
      },
      req
    });

    return res.status(201).json(result);
  } catch (error) {
    console.error('Error submitting request:', error);
    if (fileSaved) {
      try {
        await storageAdapter.deleteFile(
          requestType === 'OD' ? 'od' : 'leave',
          fileSaved.split('/')[1]
        );
      } catch (err) {
        console.error('Compensation file delete failed', err);
      }
    }
    return res.status(500).json({ message: error.message || 'Server error' });
  }
};

export const getStudentRequests = async (req, res) => {
  const studentId = req.user.studentId;
  if (!studentId) {
    return res.status(403).json({ message: 'Access denied: only students can view their requests.' });
  }

  try {
    const requests = await prisma.leaveODRequest.findMany({
      where: { studentId },
      include: {
        reviewerFaculty: { include: { user: { select: { name: true } } } },
        approvalHistory: {
          include: { actorUser: { select: { name: true } } },
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json(requests);
  } catch (error) {
    console.error('Error fetching student requests:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const getStudentRequestById = async (req, res) => {
  const studentId = req.user.studentId;
  if (!studentId) {
    return res.status(403).json({ message: 'Access denied: only students can view their requests.' });
  }

  try {
    const request = await prisma.leaveODRequest.findFirst({
      where: { id: req.params.id, studentId },
      include: {
        reviewerFaculty: { include: { user: { select: { name: true } } } },
        approvalHistory: {
          include: { actorUser: { select: { name: true } } },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!request) {
      return res.status(404).json({ message: 'Request not found.' });
    }

    return res.json(request);
  } catch (error) {
    console.error('Error fetching request:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const cancelRequest = async (req, res) => {
  const studentId = req.user.studentId;
  if (!studentId) {
    return res.status(403).json({ message: 'Access denied: only students can cancel requests.' });
  }

  try {
    // Atomic status-transition check: status must be PENDING
    const result = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.leaveODRequest.updateMany({
        where: {
          id: req.params.id,
          studentId,
          status: 'PENDING'
        },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date()
        }
      });

      if (updateResult.count === 0) {
        throw new Error('CONCURRENCY_ERROR');
      }

      const request = await tx.leaveODRequest.findUnique({
        where: { id: req.params.id }
      });

      await tx.approvalHistory.create({
        data: {
          requestId: request.id,
          actorUserId: req.user.id,
          action: 'CANCELLED',
          remarks: 'Request cancelled by student'
        }
      });

      return request;
    });

    // Log audit
    await logAudit({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: result.requestType === 'OD' ? AUDIT_ACTIONS.OD_REQUEST_CANCELLED : AUDIT_ACTIONS.LEAVE_REQUEST_CANCELLED,
      entityType: 'LeaveODRequest',
      entityId: result.id,
      newValue: { status: 'CANCELLED' },
      req
    });

    return res.json({ message: 'Request cancelled successfully', request: result });
  } catch (error) {
    if (error.message === 'CONCURRENCY_ERROR') {
      return res.status(409).json({ message: 'Request cannot be cancelled. It may have already been processed or cancelled.' });
    }
    console.error('Error cancelling request:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const getReviewers = async (req, res) => {
  const studentId = req.user.studentId;
  if (!studentId) {
    return res.status(403).json({ message: 'Access denied.' });
  }

  try {
    const student = await prisma.student.findUnique({
      where: { id: studentId }
    });

    if (!student) {
      return res.status(404).json({ message: 'Student profile not found.' });
    }

    const reviewers = await prisma.faculty.findMany({
      where: { departmentId: student.departmentId },
      select: {
        id: true,
        designation: true,
        user: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });

    // Temporary reviewer-selection policy caused by current schema limitations: Return ID, Name, Designation
    const mapped = reviewers.map(f => ({
      id: f.id,
      name: f.user.name,
      designation: f.designation,
      email: f.user.email
    }));

    return res.json(mapped);
  } catch (error) {
    console.error('Error fetching reviewers:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const getFacultyReviewInbox = async (req, res) => {
  const facultyId = req.user.facultyId;
  if (!facultyId) {
    return res.status(403).json({ message: 'Access denied: only faculty can review requests.' });
  }

  const { status } = req.query;

  try {
    const where = { reviewerFacultyId: facultyId };
    if (status) {
      where.status = status;
    }

    const requests = await prisma.leaveODRequest.findMany({
      where,
      include: {
        student: {
          include: {
            user: { select: { name: true, email: true } },
            department: { select: { name: true, code: true } }
          }
        },
        approvalHistory: {
          include: { actorUser: { select: { name: true } } },
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json(requests);
  } catch (error) {
    console.error('Error fetching review inbox:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const getFacultyRequestById = async (req, res) => {
  const facultyId = req.user.facultyId;
  if (!facultyId) {
    return res.status(403).json({ message: 'Access denied: only faculty can view requests.' });
  }

  try {
    const request = await prisma.leaveODRequest.findFirst({
      where: { id: req.params.id, reviewerFacultyId: facultyId },
      include: {
        student: {
          include: {
            user: { select: { name: true, email: true } },
            department: { select: { name: true, code: true } }
          }
        },
        approvalHistory: {
          include: { actorUser: { select: { name: true } } },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!request) {
      return res.status(404).json({ message: 'Request not found or access denied.' });
    }

    return res.json(request);
  } catch (error) {
    console.error('Error fetching request:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const approveRequest = async (req, res) => {
  const facultyId = req.user.facultyId;
  if (!facultyId) {
    return res.status(403).json({ message: 'Access denied: only faculty can approve requests.' });
  }

  const validation = requestReviewSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ message: 'Validation failed', errors: validation.error.format() });
  }

  const { remarks } = validation.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Atomic status-transition check: must be PENDING
      const updateResult = await tx.leaveODRequest.updateMany({
        where: {
          id: req.params.id,
          reviewerFacultyId: facultyId,
          status: 'PENDING'
        },
        data: {
          status: 'APPROVED'
        }
      });

      if (updateResult.count === 0) {
        throw new Error('CONCURRENCY_ERROR');
      }

      const request = await tx.leaveODRequest.findUnique({
        where: { id: req.params.id },
        include: { student: { include: { user: true } } }
      });

      await tx.approvalHistory.create({
        data: {
          requestId: request.id,
          actorUserId: req.user.id,
          action: 'APPROVED',
          remarks: remarks || 'Approved'
        }
      });

      await createNotification({
        userId: request.student.userId,
        title: `${request.requestType} Request Approved`,
        message: `Your ${request.requestType} request for ${request.startDate.toISOString().split('T')[0]} has been approved.`,
        type: request.requestType === 'OD' ? 'OD_STATUS' : 'LEAVE_STATUS',
        priority: 'NORMAL',
        relatedEntityType: 'LeaveODRequest',
        relatedEntityId: request.id
      }, tx);

      return request;
    });

    // Log audit
    await logAudit({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: result.requestType === 'OD' ? AUDIT_ACTIONS.OD_REQUEST_APPROVED : AUDIT_ACTIONS.LEAVE_REQUEST_APPROVED,
      entityType: 'LeaveODRequest',
      entityId: result.id,
      newValue: { status: 'APPROVED', remarks },
      req
    });

    return res.json({ message: 'Request approved successfully', request: result });
  } catch (error) {
    if (error.message === 'CONCURRENCY_ERROR') {
      return res.status(409).json({ message: 'Request is no longer pending or you are not authorized to approve it.' });
    }
    console.error('Error approving request:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const rejectRequest = async (req, res) => {
  const facultyId = req.user.facultyId;
  if (!facultyId) {
    return res.status(403).json({ message: 'Access denied: only faculty can reject requests.' });
  }

  const validation = requestRejectSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ message: 'Validation failed', errors: validation.error.format() });
  }

  const { remarks } = validation.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Atomic status-transition check: must be PENDING
      const updateResult = await tx.leaveODRequest.updateMany({
        where: {
          id: req.params.id,
          reviewerFacultyId: facultyId,
          status: 'PENDING'
        },
        data: {
          status: 'REJECTED'
        }
      });

      if (updateResult.count === 0) {
        throw new Error('CONCURRENCY_ERROR');
      }

      const request = await tx.leaveODRequest.findUnique({
        where: { id: req.params.id },
        include: { student: { include: { user: true } } }
      });

      await tx.approvalHistory.create({
        data: {
          requestId: request.id,
          actorUserId: req.user.id,
          action: 'REJECTED',
          remarks
        }
      });

      await createNotification({
        userId: request.student.userId,
        title: `${request.requestType} Request Rejected`,
        message: `Your ${request.requestType} request for ${request.startDate.toISOString().split('T')[0]} has been rejected. Remarks: ${remarks}`,
        type: request.requestType === 'OD' ? 'OD_STATUS' : 'LEAVE_STATUS',
        priority: 'NORMAL',
        relatedEntityType: 'LeaveODRequest',
        relatedEntityId: request.id
      }, tx);

      return request;
    });

    // Log audit
    await logAudit({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: result.requestType === 'OD' ? AUDIT_ACTIONS.OD_REQUEST_REJECTED : AUDIT_ACTIONS.LEAVE_REQUEST_REJECTED,
      entityType: 'LeaveODRequest',
      entityId: result.id,
      newValue: { status: 'REJECTED', remarks },
      req
    });

    return res.json({ message: 'Request rejected successfully', request: result });
  } catch (error) {
    if (error.message === 'CONCURRENCY_ERROR') {
      return res.status(409).json({ message: 'Request is no longer pending or you are not authorized to reject it.' });
    }
    console.error('Error rejecting request:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const getAdminRequests = async (req, res) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Access denied: admin role required.' });
  }

  const { departmentId, batchYear, section, requestType, status, startDate, endDate } = req.query;
  let limit = parseInt(req.query.limit) || 25;
  let page = parseInt(req.query.page) || 1;

  if (limit > 100) limit = 100;
  if (limit < 1) limit = 25;
  if (page < 1) page = 1;

  const skip = (page - 1) * limit;

  try {
    const where = {};

    if (requestType) {
      if (!['LEAVE', 'OD'].includes(requestType)) {
        return res.status(400).json({ message: 'Invalid requestType parameter.' });
      }
      where.requestType = requestType;
    }

    if (status) {
      if (!['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status parameter.' });
      }
      where.status = status;
    }

    const studentFilters = {};
    if (departmentId) studentFilters.departmentId = departmentId;
    if (batchYear) studentFilters.batchYear = batchYear;
    if (section) studentFilters.section = section;

    if (Object.keys(studentFilters).length > 0) {
      where.student = studentFilters;
    }

    if (startDate || endDate) {
      where.OR = [];
      if (startDate && endDate) {
        where.startDate = { lte: new Date(endDate + 'T00:00:00.000Z') };
        where.endDate = { gte: new Date(startDate + 'T00:00:00.000Z') };
      } else if (startDate) {
        where.endDate = { gte: new Date(startDate + 'T00:00:00.000Z') };
      } else if (endDate) {
        where.startDate = { lte: new Date(endDate + 'T00:00:00.000Z') };
      }
    }

    const total = await prisma.leaveODRequest.count({ where });

    // Exclude private details: do not return full reason text or attachment path in lists
    const requests = await prisma.leaveODRequest.findMany({
      where,
      select: {
        id: true,
        requestType: true,
        startDate: true,
        endDate: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        cancelledAt: true,
        originalDocumentName: true,
        student: {
          select: {
            id: true,
            rollNo: true,
            batchYear: true,
            section: true,
            user: { select: { name: true, email: true } },
            department: { select: { name: true, code: true } }
          }
        },
        reviewerFaculty: {
          select: {
            id: true,
            designation: true,
            user: { select: { name: true, email: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    });

    return res.json({
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      requests
    });
  } catch (error) {
    console.error('Error fetching admin requests:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const getAdminRequestById = async (req, res) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Access denied: admin role required.' });
  }

  try {
    const request = await prisma.leaveODRequest.findUnique({
      where: { id: req.params.id },
      include: {
        student: {
          include: {
            user: { select: { name: true, email: true } },
            department: { select: { name: true, code: true } }
          }
        },
        reviewerFaculty: {
          include: { user: { select: { name: true, email: true } } }
        },
        approvalHistory: {
          include: { actorUser: { select: { name: true } } },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!request) {
      return res.status(404).json({ message: 'Request not found.' });
    }

    return res.json(request);
  } catch (error) {
    console.error('Error fetching request:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const downloadDocument = async (req, res) => {
  const { role, studentId, facultyId } = req.user;

  try {
    const request = await prisma.leaveODRequest.findUnique({
      where: { id: req.params.id }
    });

    if (!request) {
      return res.status(404).json({ message: 'Request not found.' });
    }

    if (!request.attachmentPath) {
      return res.status(404).json({ message: 'No attachment for this request.' });
    }

    // Admin Privacy Block: No downloads allowed for admin
    if (role === 'ADMIN') {
      return res.status(403).json({ message: 'Admin accounts are not authorized to download student files due to Privacy boundaries during Phase 6.' });
    }

    // Role-based Access Checks
    if (role === 'STUDENT') {
      if (request.studentId !== studentId) {
        return res.status(403).json({ message: 'Access denied: you can only download your own files.' });
      }
    } else if (role === 'FACULTY') {
      if (request.reviewerFacultyId !== facultyId) {
        return res.status(403).json({ message: 'Access denied: you are not the assigned reviewer for this request.' });
      }
    } else {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const filename = path.basename(request.attachmentPath);
    const absolutePath = path.resolve('uploads', request.requestType === 'OD' ? 'od' : 'leave', filename);

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ message: 'File not found on server.' });
    }

    const ext = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === '.pdf') contentType = 'application/pdf';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${request.originalDocumentName || filename}"`);
    return res.sendFile(absolutePath);
  } catch (error) {
    console.error('Error downloading document:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};
