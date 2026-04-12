import assert from "node:assert/strict";
import test from "node:test";

import { createApp } from "../../apps/api/src/server.js";

function createMockResponse() {
  const headers = new Map();

  return {
    body: undefined,
    statusCode: 200,
    getHeader(name) {
      return headers.get(name.toLowerCase());
    },
    json(payload) {
      this.setHeader("Content-Type", "application/json; charset=utf-8");
      this.body = payload;
      return this;
    },
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
    }
  };
}

test("GET /health returns API health status", async () => {
  const app = createApp();
  const healthRouteLayer = app._router.stack.find((layer) => layer.route?.path === "/health");

  assert.ok(healthRouteLayer, "expected /health route to be registered");

  const response = createMockResponse();
  await healthRouteLayer.route.stack[0].handle({}, response);

  assert.equal(response.statusCode, 200);
  assert.match(response.getHeader("content-type") ?? "", /application\/json/);
  assert.deepEqual(response.body, {
    status: "ok"
  });
});
