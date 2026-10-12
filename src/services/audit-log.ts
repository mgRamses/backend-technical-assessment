import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import type { EncryptedPayload } from "./encryption.js";

export interface AuditRecord {
  timestamp: string;
  requestId: string;
  sanitizedMessage: string;
  encryptedOriginalMessage: EncryptedPayload;
}

export class AuditLogger {
  private writeQueue: Promise<void> = Promise.resolve();

  public constructor(private readonly filePath: string) {}

  public append(record: AuditRecord): Promise<void> {
    // Serialize an explicit allowlist so unexpected caller properties cannot enter the audit file.
    const auditRecord: AuditRecord = {
      timestamp: record.timestamp,
      requestId: record.requestId,
      sanitizedMessage: record.sanitizedMessage,
      encryptedOriginalMessage: record.encryptedOriginalMessage,
    };
    const line = `${JSON.stringify(auditRecord)}\n`;
    const write = this.writeQueue.then(async () => {
      await mkdir(dirname(this.filePath), { recursive: true });
      await appendFile(this.filePath, line, { encoding: "utf8" });
    });

    // Keep the queue usable if a caller handles a write error and continues.
    this.writeQueue = write.catch(() => undefined);
    return write;
  }
}
