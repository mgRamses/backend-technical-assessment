import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createApp } from "../../src/app.js";
import { AuditLogger, type AuditRecord } from "../../src/services/audit-log.js";
import { CircuitBreaker, type CircuitBreakerOptions } from "../../src/services/circuit-breaker.js";
import { EncryptionService } from "../../src/services/encryption.js";
import type { AiClient } from "../../src/services/mock-ai-client.js";

type Outcome = "success" | "failure";

class ControlledAiClient implements AiClient {
  public readonly messages: string[] = [];

  public constructor(private readonly outcomes: Outcome[]) {}

  public async generateAnswer(message: string): Promise<string> {
    this.messages.push(message);
    if (this.outcomes.shift() === "failure") {
      throw new Error("controlled AI failure");
    }
    return `answer: ${message}`;
  }
}

async function buildTestService(
  outcomes: Outcome[] = ["success"],
  breakerOptions: CircuitBreakerOptions = {},
): Promise<{
  client: ControlledAiClient;
  filePath: string;
  breaker: CircuitBreaker;
  request: (body: unknown) => Promise<Response>;
}> {
  const directory = await mkdtemp(join(tmpdir(), "guardian-inquiry-test-"));
  const filePath = join(directory, "audit", "audit.jsonl");
  const client = new ControlledAiClient(outcomes);
  const breaker = new CircuitBreaker({ cooldownMs: 30_000, ...breakerOptions });
  let requestNumber = 0;
  const app = createApp({
    inquiryDependencies: {
      aiClient: client,
      circuitBreaker: breaker,
      encryptionService: new EncryptionService(Buffer.alloc(32, 9)),
      auditLogger: new AuditLogger(filePath),
      now: () => new Date("2026-10-12T00:00:00.000Z"),
      requestIdFactory: () => `request-${++requestNumber}`,
    },
  });
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Expected an HTTP port");
  }

  return {
    client,
    filePath,
    breaker,
    request: async (body) => {
      const response = await fetch(`http://127.0.0.1:${address.port}/secure-inquiry`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      server.unref();
      return response;
    },
  };
}

async function auditRecords(filePath: string): Promise<AuditRecord[]> {
  const content = await readFile(filePath, "utf8");
  return content
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as AuditRecord);
}

test("valid requests send only sanitized text to AI and audit encrypted originals", async () => {
  const service = await buildTestService();
  const original = "Reach jane@example.com. Card 4111 1111 1111 1111.";
  const response = await service.request({ userId: "sensitive-user", message: original });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    requestId: "request-1",
    answer: "answer: Reach [REDACTED: EMAIL]. Card [REDACTED: CREDIT_CARD].",
  });
  assert.deepEqual(service.client.messages, ["Reach [REDACTED: EMAIL]. Card [REDACTED: CREDIT_CARD]."]);

  const records = await auditRecords(service.filePath);
  const record = records[0];
  assert.ok(record);
  assert.equal(record.sanitizedMessage, service.client.messages[0]);
  assert.equal((await readFile(service.filePath, "utf8")).includes(original), false);
  assert.equal(record.encryptedOriginalMessage.algorithm, "aes-256-gcm");
});

test("invalid payloads are rejected without AI calls or audit records", async () => {
  const service = await buildTestService();
  const response = await service.request({ userId: "", message: 42 });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Invalid request payload" });
  assert.deepEqual(service.client.messages, []);
  await assert.rejects(() => readFile(service.filePath, "utf8"));
});

test("AI failures are audited, open the circuit, and later requests are rejected without AI invocation", async () => {
  const service = await buildTestService(["failure", "failure", "failure", "success"]);
  for (let index = 0; index < 3; index += 1) {
    const response = await service.request({ userId: "user", message: `message-${index}` });
    assert.equal(response.status, 502);
  }
  const fallback = await service.request({ userId: "user", message: "fallback-original" });

  assert.equal(fallback.status, 503);
  assert.deepEqual(await fallback.json(), { requestId: "request-4", error: "Service Busy" });
  assert.equal(service.client.messages.length, 3);
  assert.equal((await auditRecords(service.filePath)).length, 4);
});

test("a successful call resets failure count", async () => {
  const service = await buildTestService(["failure", "failure", "success", "failure"]);
  for (let index = 0; index < 2; index += 1) {
    assert.equal((await service.request({ userId: "user", message: "failure" })).status, 502);
  }
  assert.equal((await service.request({ userId: "user", message: "success" })).status, 200);
  assert.equal((await service.request({ userId: "user", message: "new failure" })).status, 502);
  assert.equal(service.breaker.state, "CLOSED");
  assert.equal(service.breaker.failureCount, 1);
});

test("the endpoint recovers through HALF_OPEN and reopens after a failed probe", async () => {
  let now = 0;
  const service = await buildTestService(
    ["failure", "failure", "failure", "success", "failure", "failure", "failure", "failure"],
    { now: () => now },
  );

  for (let index = 0; index < 3; index += 1) {
    assert.equal((await service.request({ userId: "user", message: `open-${index}` })).status, 502);
  }
  now = 30_000;
  assert.equal((await service.request({ userId: "user", message: "probe-success" })).status, 200);
  assert.equal(service.breaker.state, "CLOSED");

  for (let index = 0; index < 3; index += 1) {
    assert.equal((await service.request({ userId: "user", message: `reopen-${index}` })).status, 502);
  }
  now += 30_000;
  assert.equal((await service.request({ userId: "user", message: "probe-failure" })).status, 502);
  assert.equal(service.breaker.state, "OPEN");
});
