import assert from "node:assert/strict";
import test from "node:test";

import { loadConfig } from "../../src/config.js";

const validKey = Buffer.alloc(32, 7).toString("base64");

test("loads a base64 AES-256 audit key and default port", () => {
  const config = loadConfig({ AUDIT_ENCRYPTION_KEY: validKey });

  assert.equal(config.auditEncryptionKey.length, 32);
  assert.equal(config.port, 3000);
});

test("rejects a missing or incorrectly sized audit key", () => {
  assert.throws(() => loadConfig({}), /AUDIT_ENCRYPTION_KEY is required/);
  assert.throws(
    () => loadConfig({ AUDIT_ENCRYPTION_KEY: Buffer.alloc(31).toString("base64") }),
    /must decode to exactly 32 bytes/,
  );
});
