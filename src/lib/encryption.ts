import crypto from "crypto";

// AES-256-GCM. La cle vient de l'env SITE_CREDENTIALS_KEY (32 bytes base64).
// Format de sortie : base64(iv).base64(authTag).base64(ciphertext)

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const raw = process.env.SITE_CREDENTIALS_KEY;
  if (!raw) throw new Error("SITE_CREDENTIALS_KEY manquante");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("SITE_CREDENTIALS_KEY doit faire 32 bytes (openssl rand -base64 32)");
  }
  return key;
}

const IV_LEN = 12;
const TAG_LEN = 16;

// Format V3 (parite Yavok) : base64( iv | ciphertext | tag ).
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, enc, tag]).toString("base64");
}

export function decrypt(payload: string): string {
  const key = getKey();
  // Retro-compat : ancien format dotted "ivB64.tagB64.dataB64".
  if (payload.includes(".")) {
    const [ivB64, tagB64, dataB64] = payload.split(".");
    if (ivB64 && tagB64 && dataB64) {
      const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64"));
      decipher.setAuthTag(Buffer.from(tagB64, "base64"));
      return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
    }
  }
  // Format V3 concatene.
  const buf = Buffer.from(payload, "base64");
  if (buf.length < IV_LEN + TAG_LEN + 1) throw new Error("Encrypted payload too short");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(buf.length - TAG_LEN);
  const enc = buf.subarray(IV_LEN, buf.length - TAG_LEN);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
