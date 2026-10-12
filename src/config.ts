const AES_256_KEY_BYTES = 32;

export interface AppConfig {
  auditEncryptionKey: Buffer;
  port: number;
}

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const keyValue = environment.AUDIT_ENCRYPTION_KEY;

  if (!keyValue) {
    throw new Error("AUDIT_ENCRYPTION_KEY is required");
  }

  const auditEncryptionKey = Buffer.from(keyValue, "base64");
  if (auditEncryptionKey.length !== AES_256_KEY_BYTES) {
    throw new Error("AUDIT_ENCRYPTION_KEY must decode to exactly 32 bytes");
  }

  const portValue = environment.PORT ?? "3000";
  const port = Number(portValue);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  return { auditEncryptionKey, port };
}
