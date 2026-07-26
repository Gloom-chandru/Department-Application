import crypto from 'crypto';

// In-memory map to store validation references
// Key: validationToken (UUID / random token)
// Value: { hash, type, data, targetId, userId, expiresAt }
const store = new Map();

// Cleanup expired tokens every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [token, value] of store.entries()) {
    if (now > value.expiresAt) {
      store.delete(token);
    }
  }
}, 5 * 60 * 1000);

/**
 * Computes SHA-256 hash of a buffer.
 */
export function computeFileHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Creates and registers a short-lived validation token.
 * Expires in 15 minutes.
 */
export function registerValidation({ type, hash, data, targetId, userId }) {
  const token = crypto.randomUUID();
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

  store.set(token, {
    type,
    hash,
    data,
    targetId,
    userId,
    expiresAt
  });

  return token;
}

/**
 * Retrieves and validates a token.
 * Verifies owner, type, expiry, and that the file hash matches.
 */
export function getAndVerifyValidation(token, { userId, type, hash, targetId }) {
  const record = store.get(token);
  if (!record) {
    throw new Error('Validation token not found or has expired.');
  }

  if (Date.now() > record.expiresAt) {
    store.delete(token);
    throw new Error('Validation token has expired.');
  }

  if (record.userId !== userId) {
    throw new Error('Unauthorized validation reference.');
  }

  if (record.type !== type) {
    throw new Error('Mismatching validation type.');
  }

  if (targetId && record.targetId !== targetId) {
    throw new Error('Mismatching validation target schedule.');
  }

  if (record.hash !== hash) {
    throw new Error('The confirmed file content does not match the validated dry-run file.');
  }

  // Remove after use (one-time confirmation)
  store.delete(token);
  return record.data;
}
