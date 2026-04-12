import assert from "node:assert/strict";
import test from "node:test";

import { createInMemoryRepository } from "../../apps/api/src/repository.js";

function seedReport(repository) {
  const project = repository.createProject({
    name: "Acme Web Platform",
    customerName: "Acme"
  });
  const application = repository.createApplication(project.id, {
    name: "Storefront",
    device: "desktop",
    width: 1440,
    height: 900,
    waitTimeMs: 0,
    accessibilityTarget: {
      standard: "WCAG",
      version: "2.2",
      levels: ["A", "AA"]
    },
    screens: [
      {
        name: "Fixture",
        url: "http://fixtures.a11y.local/basic-violations"
      }
    ]
  });
  const report = repository.createReport(application.id, {
    name: "Baseline",
    authenticationEnabled: false,
    selectedScreenIds: [application.screens[0].id]
  });

  return { report };
}

test("report run repository enforces valid lifecycle transitions", () => {
  const repository = createInMemoryRepository();
  const { report } = seedReport(repository);
  const reportRun = repository.createReportRun(report.id, 1);

  assert.throws(() => {
    repository.completeReportRun(reportRun.id);
  }, /Invalid report run transition from pending to completed/);

  repository.startReportRun(reportRun.id);

  assert.throws(() => {
    repository.startReportRun(reportRun.id);
  }, /Invalid report run transition from running to running/);

  repository.completeReportRun(reportRun.id);

  assert.throws(() => {
    repository.failReportRun(reportRun.id, "unexpected");
  }, /Invalid report run transition from completed to failed/);
});
