/**
 * Centralized class-group matching helper.
 * Reusable across timetable, assignment, and future modules.
 *
 * Note: A normalized ClassGroup/Cohort entity may be introduced later
 * if institutional requirements expand beyond departmentId+batchYear+section.
 */

/**
 * Builds a Prisma where-filter object for class group matching.
 */
export function getClassGroupFilter({ departmentId, batchYear, section }) {
  return { departmentId, batchYear, section };
}

/**
 * Checks whether a given entity matches the specified class group.
 */
export function matchesClassGroup(entity, { departmentId, batchYear, section }) {
  return (
    entity.departmentId === departmentId &&
    entity.batchYear === batchYear &&
    entity.section === section
  );
}
