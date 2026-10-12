import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { AuditLogger } from "../../src/services/audit-log.js";
import { EncryptionService } from "../../src/services/encryption.js";

async function createAuditLogger(): Promise<{ logger: AuditLogger; filePath: string }> {
  const directory = await mkdtemp(join(tmpdir(), "guardian-audit-test-"));
  const filePath = join(directory, "nested", "audit.jsonl");
  return { logger: new AuditLogger(filePath), filePath };
}

test("writes the required record schema without plaintext original messages", async () => {
  const { logger, filePath } = await createAuditLogger();
  const original = "Original must stay encrypted";
  const encryptedOriginalMessage = new EncryptionService(Buffer.alloc(32, 1)).encrypt(original);

  await logger.append({
    timestamp: "2026-10-12T00:00:00.000Z",
    requestId: "request-123",
    sanitizedMessage: "Original must stay [REDACTED]",
    encryptedOriginalMessage,
  });

  const content = await readFile(filePath, "utf8");
  const record = JSON.parse(content) as Record<string, unknown>;

  assert.equal(content.includes(original), false);
  assert.deepEqual(Object.keys(record).sort(), [
    "encryptedOriginalMessage",
    "requestId",
    "sanitizedMessage",
    "timestamp",
  ]);
  assert.equal(record.requestId, "request-123");
  assert.equal(record.sanitizedMessage, "Original must stay [REDACTED]");
});

test("serializes concurrent appends as one JSON object per line", async () => {
  const { logger, filePath } = await createAuditLogger();
  const encryption = new EncryptionService(Buffer.alloc(32, 2));
  const records = Array.from({ length: 10 }, (_, index) => ({
    timestamp: new Date(index).toISOString(),
    requestId: `request-${index}`,
    sanitizedMessage: `sanitized-${index}`,
    encryptedOriginalMessage: encryption.encrypt(`original-${index}`),
  }));

  await Promise.all(records.map((record) => logger.append(record)));

  const lines = (await readFile(filePath, "utf8")).trim().split("\n");
  assert.equal(lines.length, records.length);
  assert.deepEqual(
    lines.map((line) => (JSON.parse(line) as { requestId: string }).requestId),
    records.map((record) => record.requestId),
  );
});
