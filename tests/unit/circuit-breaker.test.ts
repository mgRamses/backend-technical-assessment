import assert from "node:assert/strict";
import test from "node:test";

import { CircuitBreaker, CircuitBreakerOpenError } from "../../src/services/circuit-breaker.js";

async function fails(): Promise<never> {
  throw new Error("AI failed");
}

test("opens after exactly three consecutive failures and rejects immediately", async () => {
  let now = 0;
  const breaker = new CircuitBreaker({ cooldownMs: 30_000, now: () => now });

  await assert.rejects(() => breaker.execute(fails));
  await assert.rejects(() => breaker.execute(fails));
  assert.equal(breaker.state, "CLOSED");
  await assert.rejects(() => breaker.execute(fails));
  assert.equal(breaker.state, "OPEN");
  assert.equal(breaker.failureCount, 3);

  let invoked = false;
  await assert.rejects(
    () =>
      breaker.execute(async () => {
        invoked = true;
        return "not reached";
      }),
    CircuitBreakerOpenError,
  );
  assert.equal(invoked, false);
  now += 29_999;
  await assert.rejects(() => breaker.execute(async () => "not reached"), CircuitBreakerOpenError);
});

test("a success resets consecutive failures", async () => {
  const breaker = new CircuitBreaker();

  await assert.rejects(() => breaker.execute(fails));
  await assert.rejects(() => breaker.execute(fails));
  await breaker.execute(async () => "recovered");
  await assert.rejects(() => breaker.execute(fails));

  assert.equal(breaker.state, "CLOSED");
  assert.equal(breaker.failureCount, 1);
});

test("permits one half-open probe, closes on success, and reopens on probe failure", async () => {
  let now = 0;
  const breaker = new CircuitBreaker({ cooldownMs: 30_000, now: () => now });
  for (let count = 0; count < 3; count += 1) {
    await assert.rejects(() => breaker.execute(fails));
  }

  now = 30_000;
  let resolveProbe: ((value: string) => void) | undefined;
  const probe = breaker.execute(
    () => new Promise<string>((resolve) => {
      resolveProbe = resolve;
    }),
  );
  assert.equal(breaker.state, "HALF_OPEN");
  await assert.rejects(() => breaker.execute(async () => "second probe"), CircuitBreakerOpenError);
  resolveProbe?.("healthy");
  assert.equal(await probe, "healthy");
  assert.equal(breaker.state, "CLOSED");
  assert.equal(breaker.failureCount, 0);

  for (let count = 0; count < 3; count += 1) {
    await assert.rejects(() => breaker.execute(fails));
  }
  now += 30_000;
  await assert.rejects(() => breaker.execute(fails));
  assert.equal(breaker.state, "OPEN");
});
