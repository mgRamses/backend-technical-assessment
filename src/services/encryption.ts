import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;
const KEY_LENGTH_BYTES = 32;

/** All binary fields are base64-encoded. */
export interface EncryptedPayload {
  algorithm: typeof ALGORITHM;
  iv: string;
  authTag: string;
  ciphertext: string;
}

export class EncryptionService {
  public constructor(private readonly key: Buffer) {
    if (key.length !== KEY_LENGTH_BYTES) {
      throw new Error("Encryption key must be exactly 32 bytes");
    }
  }

  public encrypt(plaintext: string): EncryptedPayload {
    const iv = randomBytes(IV_LENGTH_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);

    return {
      algorithm: ALGORITHM,
      iv: iv.toString("base64"),
      authTag: cipher.getAuthTag().toString("base64"),
      ciphertext: ciphertext.toString("base64"),
    };
  }

  /** Intended for controlled recovery and verification, never for application logging. */
  public decrypt(payload: EncryptedPayload): string {
    if (payload.algorithm !== ALGORITHM) {
      throw new Error(`Unsupported encryption algorithm: ${payload.algorithm}`);
    }

    const decipher = createDecipheriv(ALGORITHM, this.key, Buffer.from(payload.iv, "base64"));
    decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(payload.ciphertext, "base64")),
      decipher.final(),
    ]);

    return plaintext.toString("utf8");
  }
}
