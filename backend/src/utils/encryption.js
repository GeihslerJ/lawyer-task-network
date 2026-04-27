import crypto from 'crypto';

const ENCRYPTED_PREFIX = 'enc:v1:';

function getKeyBuffer() {
  const rawKey = process.env.FIELD_ENCRYPTION_KEY;
  if (!rawKey) {
    throw new Error('FIELD_ENCRYPTION_KEY is required');
  }

  const normalized = rawKey.trim();

  if (/^[0-9a-fA-F]{64}$/.test(normalized)) {
    return Buffer.from(normalized, 'hex');
  }

  const asBase64 = Buffer.from(normalized, 'base64');
  if (asBase64.length === 32) {
    return asBase64;
  }

  throw new Error('FIELD_ENCRYPTION_KEY must be 32-byte base64 or 64-char hex');
}

export function encryptField(value) {
  if (value === null || value === undefined) return value;

  const plain = String(value);
  if (!plain) return plain;
  if (plain.startsWith(ENCRYPTED_PREFIX)) return plain;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKeyBuffer(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, authTag, encrypted]).toString('base64');

  return `${ENCRYPTED_PREFIX}${payload}`;
}

export function decryptField(value) {
  if (value === null || value === undefined) return value;

  const serialized = String(value);
  if (!serialized) return serialized;
  if (!serialized.startsWith(ENCRYPTED_PREFIX)) {
    return serialized;
  }

  const encoded = serialized.slice(ENCRYPTED_PREFIX.length);
  const payload = Buffer.from(encoded, 'base64');

  const iv = payload.subarray(0, 12);
  const authTag = payload.subarray(12, 28);
  const encrypted = payload.subarray(28);

  const decipher = crypto.createDecipheriv('aes-256-gcm', getKeyBuffer(), iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

  return decrypted.toString('utf8');
}

export function decryptUserSensitiveFields(user) {
  if (!user) return user;
  return {
    ...user,
    phone_number: decryptField(user.phone_number),
    bar_id_number: decryptField(user.bar_id_number),
  };
}
