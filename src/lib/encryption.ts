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

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(".");
}

export function decrypt(payload: string): string {
  const key = getKey();
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Payload chiffre invalide");
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}
