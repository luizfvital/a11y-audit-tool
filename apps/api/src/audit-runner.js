import { AxeBuilder } from "@axe-core/playwright";
import { chromium } from "playwright";
import { fulfillFixtureRoute, getFixtureTargetIssue } from "./audit-fixtures.js";
import { RULE_TO_GUIDELINE_ID } from "./guidelines.js";

const WCAG_VERSION_ORDER = ["2.0", "2.1", "2.2"];
const WCAG_LEVEL_ORDER = ["A", "AA", "AAA"];
const AXE_TAG_PREFIX_BY_VERSION = new Map([
  ["2.0", "wcag2"],
  ["2.1", "wcag21"],
  ["2.2", "wcag22"]
]);

function buildAxeTags(accessibilityTarget) {
  const tags = [];
  const versionLimit = WCAG_VERSION_ORDER.indexOf(accessibilityTarget.version);
  const levelLimit = Math.max(
    ...accessibilityTarget.levels.map((level) => WCAG_LEVEL_ORDER.indexOf(level))
  );

  for (let versionIndex = 0; versionIndex <= versionLimit; versionIndex += 1) {
    const version = AXE_TAG_PREFIX_BY_VERSION.get(WCAG_VERSION_ORDER[versionIndex]);

    for (let levelIndex = 0; levelIndex <= levelLimit; levelIndex += 1) {
      tags.push(`${version}${WCAG_LEVEL_ORDER[levelIndex].toLowerCase()}`);
    }
  }

  return tags;
}

function buildContextOptions(application) {
  const baseOptions = {
    viewport: {
      width: application.width,
      height: application.height
    },
    ignoreHTTPSErrors: true
  };

  if (application.device === "desktop") {
    return baseOptions;
  }

  return {
    ...baseOptions,
    hasTouch: true,
    isMobile: true
  };
}

function normalizeFindings({ reportRunId, screenId, results }) {
  const findings = [];

  for (const violation of results.violations) {
    const guidelineId = RULE_TO_GUIDELINE_ID.get(violation.id);

    if (!guidelineId) {
      throw new Error(`No guideline mapping exists for axe rule ${violation.id} in this slice.`);
    }

    for (const node of violation.nodes) {
      findings.push({
        reportRunId,
        screenId,
        guidelineId,
        ruleCode: violation.id,
        message: (node.failureSummary ?? violation.help ?? violation.description).trim(),
        selector: Array.isArray(node.target) && node.target.length > 0 ? node.target.join(" ") : "unknown",
        htmlSnippet: node.html ?? null,
        impact: violation.impact ?? null
      });
    }
  }

  return findings;
}

function summarizeFindings(findings) {
  const findingsByImpact = {};

  for (const finding of findings) {
    if (finding.impact) {
      findingsByImpact[finding.impact] = (findingsByImpact[finding.impact] ?? 0) + 1;
    }
  }

  return {
    totalFindings: findings.length,
    findingsByImpact
  };
}

export function createAuditRunner({ repository }) {
  return {
    async executeReportRun(reportRunId) {
      const reportRun = repository.getReportRunById(reportRunId);

      if (!reportRun) {
        return;
      }

      let browser;
      let totalFindings = 0;
      let screensScanned = 0;
      const findingsByImpact = {};

      try {
        repository.startReportRun(reportRunId);

        const report = repository.getReportById(reportRun.reportId);
        const application = repository.getApplicationById(report.applicationId);
        const screens = report.selectedScreenIds.map((screenId) => repository.getScreenById(screenId));

        if (report.authenticationEnabled) {
          throw new Error("Authentication-enabled reports are not supported in this slice.");
        }

        for (const screen of screens) {
          const fixtureTargetIssue = getFixtureTargetIssue(screen.url);

          if (fixtureTargetIssue) {
            throw new Error(fixtureTargetIssue);
          }
        }

        browser = await chromium.launch({ headless: true });

        for (const screen of screens) {
          const context = await browser.newContext(buildContextOptions(application));

          try {
            await context.route("**/*", async (route) => {
              const requestUrl = route.request().url();

              if (requestUrl.startsWith("http://fixtures.a11y.local")) {
                await fulfillFixtureRoute(route);
                return;
              }

              await route.abort();
            });

            const page = await context.newPage();
            await page.goto(screen.url, { waitUntil: "load", timeout: 30000 });
            await page.waitForTimeout(application.waitTimeMs);

            const results = await new AxeBuilder({ page })
              .withTags(buildAxeTags(application.accessibilityTarget))
              .analyze();

            const normalizedFindings = normalizeFindings({
              reportRunId,
              screenId: screen.id,
              results
            });
            const persistedFindings = repository.createFindings(normalizedFindings);
            const findingSummary = summarizeFindings(persistedFindings);

            totalFindings += findingSummary.totalFindings;
            screensScanned += 1;

            for (const [impact, count] of Object.entries(findingSummary.findingsByImpact)) {
              findingsByImpact[impact] = (findingsByImpact[impact] ?? 0) + count;
            }

            repository.updateReportRunSummary(reportRunId, {
              totalFindings,
              screensScanned,
              findingsByImpact
            });
          } finally {
            await context.close();
          }
        }

        repository.completeReportRun(reportRunId);
      } catch (error) {
        repository.failReportRun(
          reportRunId,
          error instanceof Error ? error.message : "The audit runner failed unexpectedly."
        );
      } finally {
        if (browser) {
          await browser.close();
        }
      }
    }
  };
}
