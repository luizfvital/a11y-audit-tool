import assert from "node:assert/strict";
import test from "node:test";

import { FIXTURE_ORIGIN } from "../../apps/api/src/audit-fixtures.js";
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

async function createReport(client, applicationId, overrides = {}) {
  const response = await client.request(`/applications/${applicationId}/reports`, {
    method: "POST",
    body: {
      name: "Purchase Journey Baseline",
      authenticationEnabled: false,
      selectedScreenIds: [],
      ...overrides
    }
  });

  assert.equal(response.status, 201);

  return response.body.data;
}

function sleep(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function waitForReportRunToReachTerminalState(client, reportRunId) {
  const observedStatuses = [];

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const response = await client.request(`/report-runs/${reportRunId}`);
    observedStatuses.push(response.body.data.status);

    if (response.body.data.status === "completed" || response.body.data.status === "failed") {
      return {
        observedStatuses,
        reportRun: response.body.data
      };
    }

    await sleep(100);
  }

  throw new Error(`Report run ${reportRunId} did not reach a terminal state in time.`);
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

test("report endpoints create, list, get, and update reports while sanitizing authentication", async () => {
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

    const createdReport = await createReport(client, application.id, {
      selectedScreenIds: [application.screens[0].id]
    });

    assert.equal(createdReport.applicationId, application.id);
    assert.deepEqual(createdReport.selectedScreenIds, [application.screens[0].id]);
    assert.equal("authentication" in createdReport, false);

    const listResponse = await client.request(`/applications/${application.id}/reports`);
    assert.equal(listResponse.status, 200);
    assert.equal(listResponse.body.data.length, 1);
    assert.equal(listResponse.body.data[0].id, createdReport.id);

    const getResponse = await client.request(`/reports/${createdReport.id}`);
    assert.equal(getResponse.status, 200);
    assert.deepEqual(getResponse.body.data, createdReport);

    const patchResponse = await client.request(`/reports/${createdReport.id}`, {
      method: "PATCH",
      body: {
        authenticationEnabled: true,
        authentication: {
          loginUrl: "https://shop.acme.test/account/login",
          username: "audit.user@example.com",
          password: "secret-password"
        },
        selectedScreenIds: application.screens.map((screen) => screen.id)
      }
    });

    assert.equal(patchResponse.status, 200);
    assert.equal(patchResponse.body.data.authenticationEnabled, true);
    assert.deepEqual(
      patchResponse.body.data.selectedScreenIds,
      application.screens.map((screen) => screen.id)
    );
    assert.deepEqual(patchResponse.body.data.authentication, {
      loginUrl: "https://shop.acme.test/account/login",
      username: "audit.user@example.com"
    });
    assert.equal("password" in patchResponse.body.data.authentication, false);

    const disableAuthResponse = await client.request(`/reports/${createdReport.id}`, {
      method: "PATCH",
      body: {
        authenticationEnabled: false
      }
    });

    assert.equal(disableAuthResponse.status, 200);
    assert.equal(disableAuthResponse.body.data.authenticationEnabled, false);
    assert.equal("authentication" in disableAuthResponse.body.data, false);
  } finally {
    await client.close();
  }
});

test("report endpoints reject invalid payloads, foreign screen ids, and missing resources", async () => {
  const client = await createTestClient(createApp());

  try {
    const invalidCreateResponse = await client.request(
      "/applications/11111111-1111-4111-8111-111111111111/reports",
      {
        method: "POST",
        body: {
          name: "",
          authenticationEnabled: true,
          selectedScreenIds: ["not-a-uuid"]
        }
      }
    );

    assert.equal(invalidCreateResponse.status, 400);
    assert.equal(invalidCreateResponse.body.error.code, "invalid_request");

    const project = await createProject(client);
    const firstApplication = await createApplication(client, project.id, {
      screens: [
        {
          name: "Home",
          url: "https://shop.acme.test/"
        }
      ]
    });
    const secondApplication = await createApplication(client, project.id, {
      screens: [
        {
          name: "Portal",
          url: "https://portal.acme.test/"
        }
      ]
    });

    const foreignScreenResponse = await client.request(
      `/applications/${firstApplication.id}/reports`,
      {
        method: "POST",
        body: {
          name: "Cross Application Report",
          authenticationEnabled: false,
          selectedScreenIds: [secondApplication.screens[0].id]
        }
      }
    );

    assert.equal(foreignScreenResponse.status, 400);
    assert.match(
      foreignScreenResponse.body.error.details[0].issue,
      /does not belong to application/
    );

    const report = await createReport(client, firstApplication.id, {
      selectedScreenIds: [firstApplication.screens[0].id]
    });

    const emptyPatchResponse = await client.request(`/reports/${report.id}`, {
      method: "PATCH",
      body: {}
    });

    assert.equal(emptyPatchResponse.status, 400);
    assert.deepEqual(emptyPatchResponse.body.error.details, [
      {
        field: "body",
        issue: "must include at least one report field"
      }
    ]);

    const invalidPatchResponse = await client.request(`/reports/${report.id}`, {
      method: "PATCH",
      body: {
        authenticationEnabled: true
      }
    });

    assert.equal(invalidPatchResponse.status, 400);
    assert.deepEqual(invalidPatchResponse.body.error.details, [
      {
        field: "authentication.loginUrl",
        issue: "is required when authenticationEnabled is true"
      },
      {
        field: "authentication.username",
        issue: "is required when authenticationEnabled is true"
      }
    ]);

    const missingReportResponse = await client.request(
      "/reports/11111111-1111-4111-8111-111111111111"
    );

    assert.equal(missingReportResponse.status, 404);
    assert.equal(missingReportResponse.body.error.code, "resource_not_found");
  } finally {
    await client.close();
  }
});

test("report run execution completes for fixture-backed reports and persists findings and guidelines", async () => {
  const client = await createTestClient(createApp());

  try {
    const project = await createProject(client);
    const application = await createApplication(client, project.id, {
      waitTimeMs: 150,
      screens: [
        {
          name: "Home",
          url: `${FIXTURE_ORIGIN}/basic-violations`
        },
        {
          name: "Checkout",
          url: `${FIXTURE_ORIGIN}/basic-violations`
        }
      ]
    });
    const report = await createReport(client, application.id, {
      selectedScreenIds: application.screens.map((screen) => screen.id)
    });

    const createRunResponse = await client.request(`/reports/${report.id}/report-runs`, {
      method: "POST"
    });

    assert.equal(createRunResponse.status, 201);
    assert.equal(createRunResponse.body.data.reportId, report.id);
    assert.equal(createRunResponse.body.data.status, "pending");
    assert.equal(createRunResponse.body.data.startedAt, null);

    const { observedStatuses, reportRun } = await waitForReportRunToReachTerminalState(
      client,
      createRunResponse.body.data.id
    );

    assert.equal(observedStatuses.includes("running"), true);
    assert.equal(reportRun.status, "completed");
    assert.notEqual(reportRun.startedAt, null);
    assert.notEqual(reportRun.finishedAt, null);
    assert.equal(reportRun.errorMessage, null);
    assert.equal(reportRun.summary.screensPlanned, 2);
    assert.equal(reportRun.summary.screensScanned, 2);
    assert.equal(reportRun.summary.totalFindings, 4);
    assert.deepEqual(reportRun.summary.findingsByImpact, {
      critical: 4
    });

    const listRunsResponse = await client.request(`/reports/${report.id}/report-runs`);
    assert.equal(listRunsResponse.status, 200);
    assert.equal(listRunsResponse.body.data.length, 1);
    assert.equal(listRunsResponse.body.data[0].id, createRunResponse.body.data.id);
    assert.equal(listRunsResponse.body.data[0].status, "completed");

    const findingsResponse = await client.request(`/report-runs/${reportRun.id}/findings`);
    assert.equal(findingsResponse.status, 200);
    assert.equal(findingsResponse.body.data.length, 4);
    assert.deepEqual(
      [...new Set(findingsResponse.body.data.map((finding) => finding.ruleCode))].sort(),
      ["button-name", "image-alt"]
    );

    const findingResponse = await client.request(`/findings/${findingsResponse.body.data[0].id}`);
    assert.equal(findingResponse.status, 200);
    assert.equal(findingResponse.body.data.reportRunId, reportRun.id);

    const guidelinesResponse = await client.request("/guidelines");
    assert.equal(guidelinesResponse.status, 200);
    assert.equal(guidelinesResponse.body.data.length, 2);

    const guidelineResponse = await client.request(
      `/guidelines/${findingsResponse.body.data[0].guidelineId}`
    );
    assert.equal(guidelineResponse.status, 200);
    assert.equal(guidelineResponse.body.data.id, findingsResponse.body.data[0].guidelineId);
  } finally {
    await client.close();
  }
});

test("report run execution fails for authentication-enabled reports", async () => {
  const client = await createTestClient(createApp());

  try {
    const project = await createProject(client);
    const application = await createApplication(client, project.id, {
      screens: [
        {
          name: "Portal",
          url: `${FIXTURE_ORIGIN}/basic-violations`
        }
      ]
    });

    const report = await createReport(client, application.id, {
      authenticationEnabled: true,
      authentication: {
        loginUrl: "https://shop.acme.test/account/login",
        username: "audit.user@example.com",
        password: "secret-password"
      },
      selectedScreenIds: [application.screens[0].id]
    });

    const createRunResponse = await client.request(`/reports/${report.id}/report-runs`, {
      method: "POST"
    });
    assert.equal(createRunResponse.status, 201);

    const { reportRun } = await waitForReportRunToReachTerminalState(
      client,
      createRunResponse.body.data.id
    );

    assert.equal(reportRun.status, "failed");
    assert.match(reportRun.errorMessage ?? "", /Authentication-enabled reports are not supported/);
    assert.equal(reportRun.summary.totalFindings, 0);
    assert.equal(reportRun.summary.screensScanned, 0);
  } finally {
    await client.close();
  }
});

test("report run execution fails for non-fixture screen URLs", async () => {
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
    const report = await createReport(client, application.id, {
      selectedScreenIds: [application.screens[0].id]
    });

    const createRunResponse = await client.request(`/reports/${report.id}/report-runs`, {
      method: "POST"
    });

    const { reportRun } = await waitForReportRunToReachTerminalState(
      client,
      createRunResponse.body.data.id
    );

    assert.equal(reportRun.status, "failed");
    assert.match(reportRun.errorMessage ?? "", /Only http:\/\/fixtures\.a11y\.local URLs can be scanned/);
  } finally {
    await client.close();
  }
});

test("report run execution fails when an axe rule has no guideline mapping", async () => {
  const client = await createTestClient(createApp());

  try {
    const project = await createProject(client);
    const application = await createApplication(client, project.id, {
      screens: [
        {
          name: "Unmapped Rule Screen",
          url: `${FIXTURE_ORIGIN}/unmapped-rule`
        }
      ]
    });
    const report = await createReport(client, application.id, {
      selectedScreenIds: [application.screens[0].id]
    });

    const createRunResponse = await client.request(`/reports/${report.id}/report-runs`, {
      method: "POST"
    });

    const { reportRun } = await waitForReportRunToReachTerminalState(
      client,
      createRunResponse.body.data.id
    );

    assert.equal(reportRun.status, "failed");
    assert.match(reportRun.errorMessage ?? "", /No guideline mapping exists for axe rule/);
  } finally {
    await client.close();
  }
});

test("report run and findings endpoints return not found for missing resources", async () => {
  const client = await createTestClient(createApp());

  try {
    const missingReportRunsListResponse = await client.request(
      "/reports/11111111-1111-4111-8111-111111111111/report-runs"
    );
    assert.equal(missingReportRunsListResponse.status, 404);

    const missingReportRunCreateResponse = await client.request(
      "/reports/11111111-1111-4111-8111-111111111111/report-runs",
      {
        method: "POST"
      }
    );
    assert.equal(missingReportRunCreateResponse.status, 404);

    const missingRunResponse = await client.request(
      "/report-runs/11111111-1111-4111-8111-111111111111"
    );
    assert.equal(missingRunResponse.status, 404);
    assert.equal(missingRunResponse.body.error.code, "resource_not_found");

    const missingFindingsResponse = await client.request(
      "/report-runs/11111111-1111-4111-8111-111111111111/findings"
    );
    assert.equal(missingFindingsResponse.status, 404);

    const missingFindingResponse = await client.request(
      "/findings/11111111-1111-4111-8111-111111111111"
    );
    assert.equal(missingFindingResponse.status, 404);

    const missingGuidelineResponse = await client.request(
      "/guidelines/99999999-9999-4999-8999-999999999999"
    );
    assert.equal(missingGuidelineResponse.status, 404);
  } finally {
    await client.close();
  }
});
