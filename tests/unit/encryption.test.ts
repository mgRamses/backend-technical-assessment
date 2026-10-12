import assert from "node:assert/strict";
import test from "node:test";

import { EncryptionService } from "../../src/services/encryption.js";

const key = Buffer.alloc(32, 3);

test("encrypts and decrypts a UTF-8 message", () => {
  const service = new EncryptionService(key);
  const payload = service.encrypt("sensitive message ✓");

  assert.equal(payload.algorithm, "aes-256-gcm");
  assert.notEqual(payload.ciphertext, Buffer.from("sensitive message ✓").toString("base64"));
  assert.equal(service.decrypt(payload), "sensitive message ✓");
});

test("uses distinct IVs for repeated encryption", () => {
  const service = new EncryptionService(key);
  const first = service.encrypt("same message");
  const second = service.encrypt("same message");

  assert.notEqual(first.iv, second.iv);
  assert.notEqual(first.ciphertext, second.ciphertext);
});

test("rejects ciphertext and authentication-tag tampering", () => {
  const service = new EncryptionService(key);
  const payload = service.encrypt("protected message");
  const tamperedCiphertext = { ...payload, ciphertext: `${payload.ciphertext.slice(0, -2)}AA` };
  const tamperedTag = { ...payload, authTag: `${payload.authTag.slice(0, -2)}AA` };

  assert.throws(() => service.decrypt(tamperedCiphertext));
  assert.throws(() => service.decrypt(tamperedTag));
});
