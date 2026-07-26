/**
 * Reusable authorization hook to determine file access permissions.
 * Currently in Phase 1:
 * - ADMIN role is allowed access.
 * - STUDENT and FACULTY roles are denied by default since database-backed relationships 
 *   (e.g., assignment classes or student ownership of submissions/leaves) do not exist yet.
 * 
 * In future phases, this will query the database to verify:
 * - If STUDENT owns the submission/leave/od, or is enrolled in the subject of the assignment.
 * - If FACULTY teaches the subject or is the designated reviewer.
 */
export const authorizeFileAccess = async (user, category, filename) => {
  if (!user) {
    return false;
  }

  // Admin users are granted access to administrative snaps and backups
  if (user.role === 'ADMIN') {
    return true;
  }

  // Default to DENY until database relationships are established in later phases
  return false;
};
