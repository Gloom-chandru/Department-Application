import prisma from '../utils/db.js';
import { z } from 'zod';
import storageAdapter from '../utils/storageService.js';
import { logAudit } from '../utils/audit.js';
import { createNotification } from '../utils/notificationService.js';

// Naming consistent with AuditLog constants
const AUDIT_ACTIONS = {
  ASSIGNMENT_CREATED: 'ASSIGNMENT_CREATED',
  ASSIGNMENT_UPDATED: 'ASSIGNMENT_UPDATED',
  ASSIGNMENT_PUBLISHED: 'ASSIGNMENT_PUBLISHED',
  ASSIGNMENT_CLOSED: 'ASSIGNMENT_CLOSED',
  SUBMISSION_GRADED: 'SUBMISSION_GRADED',
};

// Zod schemas
const assignmentCreateSchema = z.object({
  subjectId: z.string().uuid(),
  title: z.string().min(3).max(100),
  description: z.string().min(10),
  dueAt: z.string().datetime(),
  maxMarks: z.preprocess((val) => parseFloat(val), z.number().finite().positive()),
  status: z.enum(['DRAFT', 'PUBLISHED']).default('DRAFT'),
  batchYear: z.string().regex(/^\d{4}-\d{2,4}$/, 'Batch year must be in format YYYY-YY or YYYY-YYYY').optional().nullable(),
  section: z.string().min(1).max(2).optional().nullable(),
});

const assignmentUpdateSchema = z.object({
  title: z.string().min(3).max(100).optional(),
  description: z.string().min(10).optional(),
  dueAt: z.string().datetime().optional(),
  maxMarks: z.preprocess((val) => parseFloat(val), z.number().finite().positive()).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'CLOSED']).optional(),
  batchYear: z.string().regex(/^\d{4}-\d{2,4}$/, 'Batch year must be in format YYYY-YY or YYYY-YYYY').optional().nullable(),
  section: z.string().min(1).max(2).optional().nullable(),
});

const gradingSchema = z.object({
  marksAwarded: z.preprocess((val) => parseFloat(val), z.number().finite().nonnegative()),
  feedback: z.string().max(500).optional().nullable(),
});

/**
 * Audience resolution helper
 */
const getEligibleStudents = async (subjectId, batchYear, section) => {
  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    select: { departmentId: true }
  });
  if (!subject) return [];

  // Match Department and Batch Year
  const whereClause = {
    departmentId: subject.departmentId,
    batchYear: batchYear || undefined
  };

  // Section filter
  if (section) {
    whereClause.section = section;
  }

  return prisma.student.findMany({
    where: whereClause,
    select: { id: true, userId: true }
  });
};

/**
 * Faculty Creates Assignment
 */
export const createAssignment = async (req, res) => {
  let fileSaved = null;
  try {
    const facultyId = req.user.facultyId;
    if (!facultyId) {
      return res.status(403).json({ message: 'Only faculty accounts can create assignments.' });
    }

    const validation = assignmentCreateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: 'Validation failed', errors: validation.error.format() });
    }

    const data = validation.data;

    // Audience safety check
    if (data.status === 'PUBLISHED' && !data.batchYear) {
      return res.status(400).json({ message: 'batchYear is required when publishing an assignment.' });
    }

    // Verify faculty teaches the subject
    const subject = await prisma.subject.findFirst({
      where: { id: data.subjectId, facultyId }
    });
    if (!subject) {
      return res.status(403).json({ message: 'You are not authorized to create assignments for this subject.' });
    }

    // Save attachment if uploaded
    let attachmentPath = null;
    let originalAttachmentName = null;
    if (req.file) {
      originalAttachmentName = req.file.originalname;
      attachmentPath = await storageAdapter.saveFile('assignments', originalAttachmentName, req.file.buffer);
      fileSaved = attachmentPath;
    }

    // DB Transaction
    const result = await prisma.$transaction(async (tx) => {
      const assignment = await tx.assignment.create({
        data: {
          subjectId: data.subjectId,
          title: data.title,
          description: data.description,
          dueAt: new Date(data.dueAt),
          maxMarks: data.maxMarks,
          status: data.status,
          batchYear: data.batchYear,
          section: data.section,
          createdByUserId: req.user.id,
          attachmentPath,
          originalAttachmentName
        }
      });

      // Dispatch notifications if published
      if (assignment.status === 'PUBLISHED') {
        const students = await getEligibleStudents(assignment.subjectId, assignment.batchYear, assignment.section);
        if (students.length > 0) {
          const notifs = students.map((s) => ({
            userId: s.userId,
            title: `New Assignment Published: ${assignment.title}`,
            message: `A new assignment has been posted for subject ${subject.name}. Due on ${assignment.dueAt.toLocaleDateString()}.`,
            type: 'ASSIGNMENT_CREATED',
            priority: 'NORMAL',
            relatedEntityType: 'Assignment',
            relatedEntityId: assignment.id
          }));
          await tx.notification.createMany({ data: notifs });
        }
      }

      return assignment;
    });

    // Audit Log
    await logAudit({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: AUDIT_ACTIONS.ASSIGNMENT_CREATED,
      entityType: 'Assignment',
      entityId: result.id,
      newValue: {
        title: result.title,
        status: result.status,
        batchYear: result.batchYear,
        dueAt: result.dueAt
      },
      req
    });

    return res.status(201).json(result);
  } catch (error) {
    console.error('Error creating assignment:', error);
    if (fileSaved) {
      await storageAdapter.deleteFile('assignments', fileSaved.split('/')[1]);
    }
    return res.status(500).json({ message: 'Server error creating assignment' });
  }
};

/**
 * Faculty Updates/Publishes Assignment
 */
export const updateAssignment = async (req, res) => {
  let fileSaved = null;
  try {
    const facultyId = req.user.facultyId;
    if (!facultyId) {
      return res.status(403).json({ message: 'Only faculty accounts can edit assignments.' });
    }

    const { id } = req.params;
    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: { subject: true }
    });

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found.' });
    }

    if (assignment.subject.facultyId !== facultyId) {
      return res.status(403).json({ message: 'You are not authorized to edit this assignment.' });
    }

    const validation = assignmentUpdateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: 'Validation failed', errors: validation.error.format() });
    }

    const data = validation.data;

    // Audience safety check
    const nextStatus = data.status || assignment.status;
    const nextBatchYear = data.batchYear !== undefined ? data.batchYear : assignment.batchYear;
    if (nextStatus === 'PUBLISHED' && !nextBatchYear) {
      return res.status(400).json({ message: 'batchYear is required when publishing an assignment.' });
    }

    // Save replacement attachment if uploaded
    let attachmentPath = assignment.attachmentPath;
    let originalAttachmentName = assignment.originalAttachmentName;
    let oldAttachmentToCleanup = null;
    if (req.file) {
      originalAttachmentName = req.file.originalname;
      attachmentPath = await storageAdapter.saveFile('assignments', originalAttachmentName, req.file.buffer);
      fileSaved = attachmentPath;
      if (assignment.attachmentPath) {
        oldAttachmentToCleanup = assignment.attachmentPath;
      }
    }

    const isPublishTransition = assignment.status === 'DRAFT' && nextStatus === 'PUBLISHED';

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.assignment.update({
        where: { id },
        data: {
          title: data.title,
          description: data.description,
          dueAt: data.dueAt ? new Date(data.dueAt) : undefined,
          maxMarks: data.maxMarks,
          status: data.status,
          batchYear: data.batchYear,
          section: data.section,
          attachmentPath,
          originalAttachmentName
        }
      });

      // Dispatch notifications on first publish transition
      if (isPublishTransition) {
        const students = await getEligibleStudents(updated.subjectId, updated.batchYear, updated.section);
        if (students.length > 0) {
          const notifs = students.map((s) => ({
            userId: s.userId,
            title: `New Assignment Published: ${updated.title}`,
            message: `A new assignment has been posted for subject ${assignment.subject.name}. Due on ${updated.dueAt.toLocaleDateString()}.`,
            type: 'ASSIGNMENT_CREATED',
            priority: 'NORMAL',
            relatedEntityType: 'Assignment',
            relatedEntityId: updated.id
          }));
          await tx.notification.createMany({ data: notifs });
        }
      }

      return updated;
    });

    // Cleanup old file only after successful DB update commit
    if (oldAttachmentToCleanup) {
      await storageAdapter.deleteFile('assignments', oldAttachmentToCleanup.split('/')[1]);
    }

    // Audit Log
    let auditAction = AUDIT_ACTIONS.ASSIGNMENT_UPDATED;
    if (isPublishTransition) {
      auditAction = AUDIT_ACTIONS.ASSIGNMENT_PUBLISHED;
    } else if (data.status === 'CLOSED') {
      auditAction = AUDIT_ACTIONS.ASSIGNMENT_CLOSED;
    }

    await logAudit({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: auditAction,
      entityType: 'Assignment',
      entityId: result.id,
      newValue: {
        title: result.title,
        status: result.status,
        batchYear: result.batchYear,
        dueAt: result.dueAt
      },
      previousValue: {
        title: assignment.title,
        status: assignment.status,
        batchYear: assignment.batchYear,
        dueAt: assignment.dueAt
      },
      req
    });

    return res.json(result);
  } catch (error) {
    console.error('Error updating assignment:', error);
    if (fileSaved) {
      await storageAdapter.deleteFile('assignments', fileSaved.split('/')[1]);
    }
    return res.status(500).json({ message: 'Server error updating assignment' });
  }
};

/**
 * Faculty Deletes Draft Assignment
 */
export const deleteAssignment = async (req, res) => {
  try {
    const facultyId = req.user.facultyId;
    if (!facultyId) {
      return res.status(403).json({ message: 'Only faculty accounts can delete assignments.' });
    }

    const { id } = req.params;
    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: { subject: true }
    });

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found.' });
    }

    if (assignment.subject.facultyId !== facultyId) {
      return res.status(403).json({ message: 'You are not authorized to delete this assignment.' });
    }

    if (assignment.status !== 'DRAFT') {
      return res.status(400).json({ message: 'Published or closed assignments cannot be deleted to protect academic integrity.' });
    }

    // Delete assignment
    await prisma.assignment.delete({ where: { id } });

    // Clean attachment file
    if (assignment.attachmentPath) {
      await storageAdapter.deleteFile('assignments', assignment.attachmentPath.split('/')[1]);
    }

    return res.json({ message: 'Draft assignment deleted successfully' });
  } catch (error) {
    console.error('Error deleting assignment:', error);
    return res.status(500).json({ message: 'Server error deleting assignment' });
  }
};

/**
 * List Assignments for Student
 */
export const getStudentAssignments = async (req, res) => {
  try {
    const studentId = req.user.studentId;
    if (!studentId) {
      return res.status(403).json({ message: 'Only student accounts can fetch assignments.' });
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId }
    });

    if (!student) {
      return res.status(404).json({ message: 'Student profile not found.' });
    }

    // Retrieve published or closed assignments matching the audience rules
    const assignments = await prisma.assignment.findMany({
      where: {
        status: { in: ['PUBLISHED', 'CLOSED'] },
        subject: { departmentId: student.departmentId },
        batchYear: student.batchYear,
        OR: [
          { section: null },
          { section: student.section }
        ]
      },
      include: {
        subject: { select: { name: true, code: true, semester: true } },
        submissions: {
          where: { studentId },
          select: { id: true, submittedAt: true, status: true, marksAwarded: true, feedback: true }
        }
      },
      orderBy: { dueAt: 'asc' }
    });

    // Format output mapping derived late/not submitted statuses
    const formatted = assignments.map(a => {
      const sub = a.submissions[0] || null;
      let derivedStatus = 'NOT_SUBMITTED';
      
      if (sub) {
        if (sub.status === 'GRADED') {
          derivedStatus = 'GRADED';
        } else {
          const isLate = new Date(sub.submittedAt) > new Date(a.dueAt);
          derivedStatus = isLate ? 'LATE' : 'SUBMITTED';
        }
      }

      return {
        id: a.id,
        title: a.title,
        description: a.description,
        dueAt: a.dueAt,
        maxMarks: a.maxMarks,
        status: a.status,
        batchYear: a.batchYear,
        section: a.section,
        subject: a.subject,
        hasAttachment: !!a.attachmentPath,
        originalAttachmentName: a.originalAttachmentName,
        submission: sub ? {
          id: sub.id,
          submittedAt: sub.submittedAt,
          status: derivedStatus,
          marksAwarded: sub.marksAwarded,
          feedback: sub.feedback
        } : null
      };
    });

    return res.json(formatted);
  } catch (error) {
    console.error('Error fetching student assignments:', error);
    return res.status(500).json({ message: 'Server error fetching assignments.' });
  }
};

/**
 * List Assignments for Faculty Subject
 */
export const getFacultyAssignments = async (req, res) => {
  try {
    const facultyId = req.user.facultyId;
    if (!facultyId) {
      return res.status(403).json({ message: 'Only faculty accounts can fetch subject assignments.' });
    }

    const { subjectId } = req.params;
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId }
    });

    if (!subject) {
      return res.status(404).json({ message: 'Subject not found.' });
    }

    if (subject.facultyId !== facultyId) {
      return res.status(403).json({ message: 'You are not authorized to view assignments for this subject.' });
    }

    const assignments = await prisma.assignment.findMany({
      where: { subjectId },
      include: {
        _count: { select: { submissions: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json(assignments);
  } catch (error) {
    console.error('Error fetching faculty assignments:', error);
    return res.status(500).json({ message: 'Server error fetching subject assignments.' });
  }
};

/**
 * Get Specific Assignment Details (Faculty/Student/Admin checks)
 */
export const getAssignmentDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: {
        subject: true
      }
    });

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found.' });
    }

    // Role-based Access Rules
    if (req.user.role === 'STUDENT') {
      const student = await prisma.student.findUnique({
        where: { userId: req.user.id }
      });
      
      // Enforce visibility & audience rules
      const isVisible = assignment.status === 'PUBLISHED' || assignment.status === 'CLOSED';
      const isDeptMatch = student?.departmentId === assignment.subject.departmentId;
      const isBatchMatch = student?.batchYear === assignment.batchYear;
      const isSecMatch = !assignment.section || student?.section === assignment.section;

      if (!isVisible || !isDeptMatch || !isBatchMatch || !isSecMatch) {
        return res.status(403).json({ message: 'Access denied to this assignment.' });
      }
    } else if (req.user.role === 'FACULTY') {
      if (assignment.subject.facultyId !== req.user.facultyId) {
        return res.status(403).json({ message: 'Access denied: you do not teach this subject.' });
      }
    }

    return res.json(assignment);
  } catch (error) {
    console.error('Error fetching assignment details:', error);
    return res.status(500).json({ message: 'Server error loading assignment details.' });
  }
};

/**
 * Student Submits/Replaces Work
 */
export const submitAssignment = async (req, res) => {
  let fileSaved = null;
  try {
    const studentId = req.user.studentId;
    if (!studentId) {
      return res.status(403).json({ message: 'Only student accounts can submit assignments.' });
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId }
    });

    const { id } = req.params; // Assignment ID
    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: { subject: true }
    });

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found.' });
    }

    // Audience rule enforcement
    if (assignment.status !== 'PUBLISHED') {
      return res.status(400).json({ message: 'This assignment is not open for submissions.' });
    }

    const isDeptMatch = student?.departmentId === assignment.subject.departmentId;
    const isBatchMatch = student?.batchYear === assignment.batchYear;
    const isSecMatch = !assignment.section || student?.section === assignment.section;

    if (!isDeptMatch || !isBatchMatch || !isSecMatch) {
      return res.status(403).json({ message: 'Access denied: you are not in the targeted audience.' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Submission requires an uploaded document.' });
    }

    const now = new Date();
    const existingSubmission = await prisma.assignmentSubmission.findUnique({
      where: { assignmentId_studentId: { assignmentId: id, studentId } },
      include: { versions: true }
    });

    // Deadline check
    const isPastDeadline = now > new Date(assignment.dueAt);
    if (isPastDeadline && existingSubmission) {
      return res.status(400).json({ message: 'Replacements are prohibited after the due date.' });
    }

    // Save file
    const originalFileName = req.file.originalname;
    const fileReference = await storageAdapter.saveFile('submissions', originalFileName, req.file.buffer);
    fileSaved = fileReference;

    // Prisma transactional write
    const result = await prisma.$transaction(async (tx) => {
      let submission;
      let newVersionNumber = 1;

      if (existingSubmission) {
        newVersionNumber = existingSubmission.versions.length + 1;

        // Clear grading fields if replacing a graded submission before deadline
        submission = await tx.assignmentSubmission.update({
          where: { id: existingSubmission.id },
          data: {
            submittedAt: now,
            status: 'SUBMITTED', // Reset status to submitted
            marksAwarded: null,
            feedback: null,
            gradedAt: null,
            gradedById: null
          }
        });
      } else {
        // Initial submission
        submission = await tx.assignmentSubmission.create({
          data: {
            assignmentId: id,
            studentId,
            submittedAt: now,
            status: 'SUBMITTED'
          }
        });
      }

      // Create relational submission version record
      const version = await tx.assignmentSubmissionVersion.create({
        data: {
          submissionId: submission.id,
          fileReference,
          originalFileName,
          submittedAt: now,
          versionNumber: newVersionNumber
        }
      });

      return { submission, version };
    });

    return res.status(200).json({
      message: 'Assignment submitted successfully',
      submissionId: result.submission.id,
      versionNumber: result.version.versionNumber
    });
  } catch (error) {
    console.error('Error submitting work:', error);
    if (fileSaved) {
      await storageAdapter.deleteFile('submissions', fileSaved.split('/')[1]);
    }
    return res.status(500).json({ message: 'Server error processing submission' });
  }
};

/**
 * Get Student's Own Submission info
 */
export const getMySubmission = async (req, res) => {
  try {
    const studentId = req.user.studentId;
    if (!studentId) {
      return res.status(403).json({ message: 'Only student accounts can view submissions.' });
    }

    const { id } = req.params; // Assignment ID
    const submission = await prisma.assignmentSubmission.findUnique({
      where: { assignmentId_studentId: { assignmentId: id, studentId } },
      include: {
        versions: { orderBy: { versionNumber: 'desc' } }
      }
    });

    if (!submission) {
      return res.json(null);
    }

    return res.json(submission);
  } catch (error) {
    console.error('Error loading student submission:', error);
    return res.status(500).json({ message: 'Server error loading submission details.' });
  }
};

/**
 * Faculty list submissions for Assignment
 */
export const getAssignmentSubmissions = async (req, res) => {
  try {
    const facultyId = req.user.facultyId;
    if (!facultyId) {
      return res.status(403).json({ message: 'Only faculty accounts can inspect submissions.' });
    }

    const { id } = req.params; // Assignment ID
    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: { subject: true }
    });

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found.' });
    }

    if (assignment.subject.facultyId !== facultyId) {
      return res.status(403).json({ message: 'You are not authorized to view submissions for this assignment.' });
    }

    // Get eligible student counts for KPI calculation
    const eligibleStudents = await getEligibleStudents(assignment.subjectId, assignment.batchYear, assignment.section);

    const submissions = await prisma.assignmentSubmission.findMany({
      where: { assignmentId: id },
      include: {
        student: {
          include: { user: { select: { name: true } } }
        },
        versions: { orderBy: { versionNumber: 'desc' } }
      },
      orderBy: { submittedAt: 'desc' }
    });

    // Derive statuses & count KPIs
    let submittedCount = 0;
    let lateCount = 0;
    let gradedCount = 0;

    const formatted = submissions.map(s => {
      const isGraded = s.status === 'GRADED';
      const isLate = new Date(s.submittedAt) > new Date(assignment.dueAt);

      if (isGraded) gradedCount++;
      else submittedCount++;

      if (isLate) lateCount++;

      return {
        id: s.id,
        studentId: s.studentId,
        name: s.student.user.name,
        rollNo: s.student.rollNo,
        submittedAt: s.submittedAt,
        status: isGraded ? 'GRADED' : (isLate ? 'LATE' : 'SUBMITTED'),
        marksAwarded: s.marksAwarded,
        feedback: s.feedback,
        gradedAt: s.gradedAt,
        versions: s.versions
      };
    });

    const notSubmittedCount = Math.max(0, eligibleStudents.length - submissions.length);

    return res.json({
      kpis: {
        eligible: eligibleStudents.length,
        submitted: submissions.length,
        notSubmitted: notSubmittedCount,
        late: lateCount,
        graded: gradedCount
      },
      submissions: formatted
    });
  } catch (error) {
    console.error('Error fetching submissions overview:', error);
    return res.status(500).json({ message: 'Server error loading submissions list.' });
  }
};

/**
 * Faculty Grades Submission
 */
export const gradeSubmission = async (req, res) => {
  try {
    const facultyId = req.user.facultyId;
    if (!facultyId) {
      return res.status(403).json({ message: 'Only faculty accounts can grade submissions.' });
    }

    const { assignmentId, submissionId } = req.params;

    const submission = await prisma.assignmentSubmission.findUnique({
      where: { id: submissionId },
      include: {
        assignment: { include: { subject: true } },
        student: true
      }
    });

    if (!submission || submission.assignmentId !== assignmentId) {
      return res.status(404).json({ message: 'Submission not found for this assignment.' });
    }

    if (submission.assignment.subject.facultyId !== facultyId) {
      return res.status(403).json({ message: 'You are not authorized to grade this submission.' });
    }

    const validation = gradingSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: 'Validation failed', errors: validation.error.format() });
    }

    const { marksAwarded, feedback } = validation.data;

    // Validate marks limits
    if (marksAwarded > submission.assignment.maxMarks) {
      return res.status(400).json({ message: `Score cannot exceed maximum marks (${submission.assignment.maxMarks}).` });
    }

    // No-op check
    const isNoOp = submission.status === 'GRADED' &&
                   submission.marksAwarded === marksAwarded &&
                   submission.feedback === feedback;
    if (isNoOp) {
      return res.json(submission);
    }

    // DB Transaction
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.assignmentSubmission.update({
        where: { id: submissionId },
        data: {
          marksAwarded,
          feedback,
          status: 'GRADED',
          gradedAt: new Date(),
          gradedById: req.user.id
        }
      });

      // Dispatch Notification
      await tx.notification.create({
        data: {
          userId: submission.student.userId,
          title: 'Assignment Graded',
          message: `Your submission for assignment "${submission.assignment.title}" has been graded. Marks: ${marksAwarded}/${submission.assignment.maxMarks}.`,
          type: 'ASSIGNMENT_GRADED',
          priority: 'HIGH',
          relatedEntityType: 'Assignment',
          relatedEntityId: submission.assignment.id
        }
      });

      return updated;
    });

    // Audit Log
    await logAudit({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: AUDIT_ACTIONS.SUBMISSION_GRADED,
      entityType: 'AssignmentSubmission',
      entityId: result.id,
      newValue: {
        marksAwarded: result.marksAwarded,
        feedback: result.feedback,
        status: result.status
      },
      previousValue: {
        marksAwarded: submission.marksAwarded,
        feedback: submission.feedback,
        status: submission.status
      },
      req
    });

    return res.json(result);
  } catch (error) {
    console.error('Error grading work:', error);
    return res.status(500).json({ message: 'Server error processing grades' });
  }
};

/**
 * Download Assignment Attachment
 */
export const downloadAssignmentAttachment = async (req, res) => {
  try {
    const { id } = req.params;
    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: { subject: true }
    });

    if (!assignment || !assignment.attachmentPath) {
      return res.status(404).json({ message: 'Attachment file not found.' });
    }

    // Authorization checks
    if (req.user.role === 'STUDENT') {
      const student = await prisma.student.findUnique({
        where: { userId: req.user.id }
      });
      
      const isVisible = assignment.status === 'PUBLISHED' || assignment.status === 'CLOSED';
      const isDeptMatch = student?.departmentId === assignment.subject.departmentId;
      const isBatchMatch = student?.batchYear === assignment.batchYear;
      const isSecMatch = !assignment.section || student?.section === assignment.section;

      if (!isVisible || !isDeptMatch || !isBatchMatch || !isSecMatch) {
        return res.status(403).json({ message: 'You are not authorized to download this file.' });
      }
    } else if (req.user.role === 'FACULTY') {
      if (assignment.subject.facultyId !== req.user.facultyId) {
        return res.status(403).json({ message: 'You are not authorized to download files for this subject.' });
      }
    }

    const filename = assignment.attachmentPath.split('/')[1];
    const absolutePath = storageAdapter.getFilePath('assignments', filename);
    if (!absolutePath) {
      return res.status(404).json({ message: 'File not found on disk.' });
    }

    res.download(absolutePath, assignment.originalAttachmentName || filename);
  } catch (error) {
    console.error('Error downloading attachment:', error);
    return res.status(500).json({ message: 'Server error downloading file.' });
  }
};

/**
 * Download Submission File Version
 */
export const downloadSubmissionVersion = async (req, res) => {
  try {
    const { id, studentId, versionNumber } = req.params;
    const versionNumInt = parseInt(versionNumber);

    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: { subject: true }
    });

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found.' });
    }

    // Admin privacy rule check
    if (req.user.role === 'ADMIN') {
      return res.status(403).json({ message: 'Admin accounts are not authorized to download student files due to Privacy boundaries during Phase 5.' });
    }

    // Role-based Access Checks
    if (req.user.role === 'STUDENT') {
      // Students can only access their own submissions
      if (req.user.studentId !== studentId) {
        return res.status(403).json({ message: 'Access denied: you can only download your own submissions.' });
      }
    } else if (req.user.role === 'FACULTY') {
      // Faculty can only access files for subjects they teach
      if (assignment.subject.facultyId !== req.user.facultyId) {
        return res.status(403).json({ message: 'Access denied: you do not teach this subject.' });
      }
    }

    // Fetch submission version file reference
    const submission = await prisma.assignmentSubmission.findUnique({
      where: { assignmentId_studentId: { assignmentId: id, studentId } }
    });

    if (!submission) {
      return res.status(404).json({ message: 'Submission not found.' });
    }

    const version = await prisma.assignmentSubmissionVersion.findUnique({
      where: {
        submissionId_versionNumber: {
          submissionId: submission.id,
          versionNumber: versionNumInt
        }
      }
    });

    if (!version) {
      return res.status(404).json({ message: `Version ${versionNumber} not found.` });
    }

    const filename = version.fileReference.split('/')[1];
    const absolutePath = storageAdapter.getFilePath('submissions', filename);
    if (!absolutePath) {
      return res.status(404).json({ message: 'File not found on disk.' });
    }

    res.download(absolutePath, version.originalFileName || filename);
  } catch (error) {
    console.error('Error downloading version:', error);
    return res.status(500).json({ message: 'Server error downloading submission file.' });
  }
};

/**
 * Admin overview routes
 */
export const getAdminAssignmentsOverview = async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const totalAssignments = await prisma.assignment.count();
    const publishedAssignments = await prisma.assignment.count({ where: { status: 'PUBLISHED' } });
    const totalSubmissions = await prisma.assignmentSubmission.count();

    const deptCounts = await prisma.assignment.groupBy({
      by: ['subjectId'],
      _count: { id: true }
    });

    return res.json({
      counters: {
        assignments: totalAssignments,
        published: publishedAssignments,
        submissions: totalSubmissions
      },
      distribution: deptCounts
    });
  } catch (error) {
    console.error('Error loading admin statistics:', error);
    return res.status(500).json({ message: 'Server error loading assignments stats' });
  }
};
