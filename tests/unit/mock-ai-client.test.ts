import assert from "node:assert/strict";
import test from "node:test";

import { MockAiClient } from "../../src/services/mock-ai-client.js";

test("returns a deterministic response after its injected delay", async () => {
  const client = new MockAiClient({ delayMs: 0 });

  assert.equal(await client.generateAnswer("[REDACTED: EMAIL]"), "Mock AI response: [REDACTED: EMAIL]");
});

test("supports deterministic injected failures without an HTTP control", async () => {
  const client = new MockAiClient({ delayMs: 0, shouldFail: () => true });

  await assert.rejects(() => client.generateAnswer("safe message"), /Mock AI request failed/);
});
