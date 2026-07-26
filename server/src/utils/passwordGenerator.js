import crypto from 'crypto';
import bcrypt from 'bcryptjs';

/**
 * Generates a cryptographically secure, random temporary password.
 * Length 12, includes uppercase, lowercase, numbers, and symbols.
 */
export function generateTemporaryPassword() {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const symbols = '!@#$%^&*';
  const all = upper + lower + digits + symbols;

  let password = '';
  // Ensure at least one of each character class is present
  password += upper[crypto.randomInt(0, upper.length)];
  password += lower[crypto.randomInt(0, lower.length)];
  password += digits[crypto.randomInt(0, digits.length)];
  password += symbols[crypto.randomInt(0, symbols.length)];

  // Fill the rest to length 12
  for (let i = 4; i < 12; i++) {
    password += all[crypto.randomInt(0, all.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => crypto.randomInt(-1, 2)).join('');
}

/**
 * Hashes a plaintext password using bcryptjs.
 */
export async function hashPassword(plainText) {
  return await bcrypt.hash(plainText, 10);
}
