import assert from "node:assert/strict";
import test from "node:test";

import { createApp } from "../../apps/api/src/server.js";
import { createTestClient } from "./test-client.js";

test("GET /health returns API health status", async () => {
  const client = await createTestClient(createApp());

  try {
    const response = await client.request("/health");

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /application\/json/);
    assert.deepEqual(response.body, {
      status: "ok"
    });
  } finally {
    await client.close();
  }
});
