import assert from "node:assert/strict";
import test from "node:test";

import { createApp } from "../../apps/api/src/server.js";
import { createTestClient } from "./test-client.js";

async function createProject(client, overrides = {}) {
  const response = await client.request("/projects", {
    method: "POST",
    body: {
      name: "Acme Web Platform",
      customerName: "Acme",
      ...overrides
    }
  });

  assert.equal(response.status, 201);

  return response.body.data;
}

async function createApplication(client, projectId, overrides = {}) {
  const response = await client.request(`/projects/${projectId}/applications`, {
    method: "POST",
    body: {
      name: "Storefront",
      device: "desktop",
      width: 1440,
      height: 900,
      waitTimeMs: 1500,
      accessibilityTarget: {
        standard: "WCAG",
        version: "2.2",
        levels: ["A", "AA"]
      },
      ...overrides
    }
  });

  assert.equal(response.status, 201);

  return response.body.data;
}

test("project endpoints create, list, get, and update projects", async () => {
  const client = await createTestClient(createApp());

  try {
    const createdProject = await createProject(client);

    const listResponse = await client.request("/projects");
    assert.equal(listResponse.status, 200);
    assert.equal(listResponse.body.data.length, 1);
    assert.equal(listResponse.body.data[0].id, createdProject.id);

    const getResponse = await client.request(`/projects/${createdProject.id}`);
    assert.equal(getResponse.status, 200);
    assert.deepEqual(getResponse.body.data, createdProject);

    const patchResponse = await client.request(`/projects/${createdProject.id}`, {
      method: "PATCH",
      body: {
        customerName: "Acme Corp"
      }
    });

    assert.equal(patchResponse.status, 200);
    assert.equal(patchResponse.body.data.customerName, "Acme Corp");
    assert.equal(patchResponse.body.data.name, createdProject.name);
    assert.notEqual(patchResponse.body.data.updatedAt, createdProject.updatedAt);
  } finally {
    await client.close();
  }
});

test("application endpoints create nested screens, list applications, and fetch full application state", async () => {
  const client = await createTestClient(createApp());

  try {
    const project = await createProject(client);
    const application = await createApplication(client, project.id, {
      screens: [
        {
          name: "Home",
          url: "https://shop.acme.test/"
        },
        {
          name: "Checkout",
          url: "https://shop.acme.test/checkout"
        }
      ]
    });

    assert.equal(application.projectId, project.id);
    assert.equal(application.screens.length, 2);
    assert.equal(application.screens[0].applicationId, application.id);

    const listResponse = await client.request(`/projects/${project.id}/applications`);
    assert.equal(listResponse.status, 200);
    assert.equal(listResponse.body.data.length, 1);
    assert.equal(listResponse.body.data[0].id, application.id);
    assert.equal("screens" in listResponse.body.data[0], false);

    const getResponse = await client.request(`/applications/${application.id}`);
    assert.equal(getResponse.status, 200);
    assert.equal(getResponse.body.data.screens.length, 2);
    assert.deepEqual(
      getResponse.body.data.screens.map((screen) => screen.name),
      ["Home", "Checkout"]
    );
  } finally {
    await client.close();
  }
});

test("PATCH /applications/:id updates application fields without changing screens", async () => {
  const client = await createTestClient(createApp());

  try {
    const project = await createProject(client);
    const application = await createApplication(client, project.id, {
      screens: [
        {
          name: "Home",
          url: "https://shop.acme.test/"
        }
      ]
    });

    const response = await client.request(`/applications/${application.id}`, {
      method: "PATCH",
      body: {
        width: 1366,
        height: 768,
        waitTimeMs: 2200
      }
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.width, 1366);
    assert.equal(response.body.data.height, 768);
    assert.equal(response.body.data.waitTimeMs, 2200);
    assert.equal(response.body.data.screens.length, 1);
    assert.equal(response.body.data.screens[0].name, "Home");
  } finally {
    await client.close();
  }
});

test("PATCH /applications/:id can replace screens while preserving existing ids", async () => {
  const client = await createTestClient(createApp());

  try {
    const project = await createProject(client);
    const application = await createApplication(client, project.id, {
      screens: [
        {
          name: "Home",
          url: "https://shop.acme.test/"
        },
        {
          name: "Checkout",
          url: "https://shop.acme.test/checkout"
        }
      ]
    });
    const existingHome = application.screens[0];

    const response = await client.request(`/applications/${application.id}`, {
      method: "PATCH",
      body: {
        screens: [
          {
            id: existingHome.id,
            name: "Homepage",
            url: "https://shop.acme.test/"
          },
          {
            name: "Cart",
            url: "https://shop.acme.test/cart"
          }
        ]
      }
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.screens.length, 2);
    assert.equal(response.body.data.screens[0].id, existingHome.id);
    assert.equal(response.body.data.screens[0].name, "Homepage");
    assert.deepEqual(
      response.body.data.screens.map((screen) => screen.name),
      ["Homepage", "Cart"]
    );
  } finally {
    await client.close();
  }
});

test("PUT /applications/:id/screens replaces the screen collection", async () => {
  const client = await createTestClient(createApp());

  try {
    const project = await createProject(client);
    const application = await createApplication(client, project.id, {
      screens: [
        {
          name: "Home",
          url: "https://shop.acme.test/"
        }
      ]
    });

    const response = await client.request(`/applications/${application.id}/screens`, {
      method: "PUT",
      body: {
        screens: [
          {
            name: "Product Details",
            url: "https://shop.acme.test/products/ultralight-backpack"
          },
          {
            name: "Checkout",
            url: "https://shop.acme.test/checkout"
          }
        ]
      }
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.length, 2);
    assert.deepEqual(
      response.body.data.map((screen) => screen.name),
      ["Product Details", "Checkout"]
    );

    const getResponse = await client.request(`/applications/${application.id}`);
    assert.deepEqual(
      getResponse.body.data.screens.map((screen) => screen.name),
      ["Product Details", "Checkout"]
    );
  } finally {
    await client.close();
  }
});

test("application endpoints reject invalid payloads and foreign screen ids", async () => {
  const client = await createTestClient(createApp());

  try {
    const invalidCreateResponse = await client.request("/projects/not-real/applications", {
      method: "POST",
      body: {
        name: "",
        device: "watch",
        width: 0,
        height: -1,
        waitTimeMs: -10,
        accessibilityTarget: {
          standard: "WCAG",
          version: "3.0",
          levels: ["A", "A"]
        },
        screens: [
          {
            name: "",
            url: "not-a-url"
          }
        ]
      }
    });

    assert.equal(invalidCreateResponse.status, 400);
    assert.equal(invalidCreateResponse.body.error.type, "validation_error");

    const project = await createProject(client);
    const firstApplication = await createApplication(client, project.id, {
      screens: [
        {
          name: "Home",
          url: "https://shop.acme.test/"
        }
      ]
    });
    const secondApplication = await createApplication(client, project.id);

    const foreignScreenResponse = await client.request(
      `/applications/${secondApplication.id}/screens`,
      {
        method: "PUT",
        body: {
          screens: [
            {
              id: firstApplication.screens[0].id,
              name: "Hijacked Screen",
              url: "https://shop.acme.test/"
            }
          ]
        }
      }
    );

    assert.equal(foreignScreenResponse.status, 400);
    assert.equal(foreignScreenResponse.body.error.code, "invalid_request");
    assert.match(
      foreignScreenResponse.body.error.details[0].issue,
      /does not belong to this application/
    );

    const emptyPatchResponse = await client.request(`/applications/${secondApplication.id}`, {
      method: "PATCH",
      body: {}
    });

    assert.equal(emptyPatchResponse.status, 400);
    assert.deepEqual(emptyPatchResponse.body.error.details, [
      {
        field: "body",
        issue: "must include at least one application field"
      }
    ]);

    const missingApplicationResponse = await client.request(
      "/applications/11111111-1111-4111-8111-111111111111"
    );

    assert.equal(missingApplicationResponse.status, 404);
    assert.equal(missingApplicationResponse.body.error.code, "resource_not_found");
  } finally {
    await client.close();
  }
});
