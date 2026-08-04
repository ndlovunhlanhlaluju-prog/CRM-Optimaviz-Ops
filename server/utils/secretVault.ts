import crypto from 'crypto';

const PREFIX = 'enc:v1:';

function encryptionKey() {
  const source =
    process.env.DATA_ENCRYPTION_KEY ||
    process.env.SESSION_SECRET ||
    process.env.META_APP_SECRET ||
    process.env.WHATSAPP_EMBEDDED_SIGNUP_APP_SECRET ||
    '';
  return source ? crypto.createHash('sha256').update(source).digest() : null;
}

export function encryptSecret(value: unknown): string {
  const plaintext = String(value || '');
  if (!plaintext) return '';
  const key = encryptionKey();
  if (!key) throw new Error('Secure credential storage is not configured.');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptSecret(value: unknown): string {
  const stored = String(value || '');
  if (!stored) return '';
  if (!stored.startsWith(PREFIX)) return stored;
  const key = encryptionKey();
  if (!key) return '';
  try {
    const [ivPart, tagPart, encryptedPart] = stored.slice(PREFIX.length).split('.');
    if (!ivPart || !tagPart || !encryptedPart) return '';
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivPart, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedPart, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return '';
  }
}
