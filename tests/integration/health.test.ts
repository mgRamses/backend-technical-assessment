import assert from "node:assert/strict";
import test from "node:test";

import { createApp } from "../../src/app.js";

test("health endpoint returns an OK status", async (context) => {
  const app = createApp();
  const server = app.listen(0);
  context.after(() => server.close());

  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Expected the health-test server to bind to a TCP port");
  }

  const response = await fetch(`http://127.0.0.1:${address.port}/health`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok" });
});
