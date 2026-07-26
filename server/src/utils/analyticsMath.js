/**
 * Shared utility functions for academic and attendance statistics.
 */

/**
 * Calculates the percentage of present attendance classes.
 * Returns null if no classes are held.
 */
export const calculateAttendancePercentage = (present, total) => {
  if (total === 0) return null;
  if (present < 0 || total < 0) {
    throw new Error('Attendance counts cannot be negative.');
  }
  if (present > total) {
    throw new Error('Present count cannot exceed total count.');
  }
  return parseFloat(((present / total) * 100).toFixed(2));
};

/**
 * Calculates consecutive present classes needed to reach a target percentage (e.g. 75).
 * Returns 0 if already at or above target, or if total is 0.
 */
export const calculateClassesNeededForTarget = (present, total, target = 75) => {
  if (target <= 0 || target > 100) {
    throw new Error(`Target threshold must be between 0 and 100. Received: ${target} (${typeof target})`);
  }
  if (present < 0 || total < 0) {
    throw new Error('Attendance counts cannot be negative.');
  }
  if (present > total) {
    throw new Error('Present count cannot exceed total count.');
  }
  if (total === 0) return 0;

  const currentPercent = (present / total) * 100;
  if (currentPercent >= target) return 0;

  if (target === 100) {
    return Infinity;
  }

  const r = target / 100;
  const needed = Math.ceil((r * total - present) / (1 - r));
  return needed >= 0 ? needed : 0;
};

/**
 * Calculates consecutive absent classes a student can miss before falling below target.
 * Returns 0 if already below target, or if total is 0.
 */
export const calculateClassesCanMiss = (present, total, target = 75) => {
  if (target <= 0 || target > 100) {
    throw new Error(`Target threshold must be between 0 and 100. Received: ${target} (${typeof target})`);
  }
  if (present < 0 || total < 0) {
    throw new Error('Attendance counts cannot be negative.');
  }
  if (present > total) {
    throw new Error('Present count cannot exceed total count.');
  }
  if (total === 0) return 0;

  const currentPercent = (present / total) * 100;
  if (currentPercent < target) return 0;

  const r = target / 100;
  if (r === 0) return Infinity;
  const canMiss = Math.floor((present - r * total) / r);
  return canMiss >= 0 ? canMiss : 0;
};

/**
 * Normalizes mark score to a percentage.
 * Filters out invalid boundaries and maxMarks <= 0 values.
 */
export const normalizeMarkPercentage = (obtained, max) => {
  if (max <= 0) {
    throw new Error('Maximum marks must be greater than zero.');
  }
  if (obtained < 0) {
    throw new Error('Obtained marks cannot be negative.');
  }
  if (obtained > max) {
    throw new Error('Obtained marks cannot exceed maximum marks.');
  }
  return parseFloat(((obtained / max) * 100).toFixed(2));
};
