import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

// AES-256-GCM: authenticated encryption (confidentiality + tamper detection).
// Stored format (one column): base64(iv).base64(authTag).base64(ciphertext)
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit nonce, recommended for GCM
const KEY_LENGTH = 32; // 256-bit key

function getKey(): Buffer {
    const raw = process.env.ENCRYPTION_KEY;
    if (!raw) throw new Error('Missing ENCRYPTION_KEY environment variable');

    // Key is stored base64-encoded (32 raw bytes).
    const key = Buffer.from(raw, 'base64');
    if (key.length !== KEY_LENGTH) {
        throw new Error(
            `ENCRYPTION_KEY must decode to ${KEY_LENGTH} bytes, got ${key.length}`
        );
    }
    return key;
}

export function encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH); // fresh nonce per encryption — never reuse
    const cipher = createCipheriv(ALGORITHM, getKey(), iv);

    const ciphertext = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return [
        iv.toString('base64'),
        authTag.toString('base64'),
        ciphertext.toString('base64'),
    ].join('.');
}

export function decrypt(payload: string): string {
    const [ivB64, tagB64, dataB64] = payload.split('.');
    if (!ivB64 || !tagB64 || !dataB64) {
        throw new Error('Malformed encrypted payload');
    }

    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(tagB64, 'base64');
    const ciphertext = Buffer.from(dataB64, 'base64');

    const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
    decipher.setAuthTag(authTag); // throws on tamper/wrong key during final()

    return Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
    ]).toString('utf8');
}
