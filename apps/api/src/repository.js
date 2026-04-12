import { randomUUID } from "node:crypto";
import { GUIDELINES } from "./guidelines.js";

function createTimestamp() {
  return new Date().toISOString();
}

function clone(value) {
  return structuredClone(value);
}

export function createInMemoryRepository() {
  const projects = new Map();
  const applications = new Map();
  const screens = new Map();
  const reports = new Map();
  const reportRuns = new Map();
  const findings = new Map();
  const guidelines = new Map(GUIDELINES.map((guideline) => [guideline.id, clone(guideline)]));
  const allowedReportRunTransitions = new Map([
    ["pending", new Set(["running"])],
    ["running", new Set(["completed", "failed"])],
    ["completed", new Set()],
    ["failed", new Set()]
  ]);

  function listProjectScreens(applicationId) {
    return Array.from(screens.values())
      .filter((screen) => screen.applicationId === applicationId)
      .map(clone);
  }

  function buildApplication(application, { includeScreens = false } = {}) {
    const result = clone(application);

    if (includeScreens) {
      result.screens = listProjectScreens(application.id);
    }

    return result;
  }

  function sanitizeReport(report) {
    const result = clone(report);

    if (!result.authenticationEnabled || !result.authentication) {
      delete result.authentication;
      return result;
    }

    const sanitizedAuthentication = {};

    if (result.authentication.loginUrl !== undefined) {
      sanitizedAuthentication.loginUrl = result.authentication.loginUrl;
    }

    if (result.authentication.username !== undefined) {
      sanitizedAuthentication.username = result.authentication.username;
    }

    if (Object.keys(sanitizedAuthentication).length > 0) {
      result.authentication = sanitizedAuthentication;
    } else {
      delete result.authentication;
    }

    return result;
  }

  function ensureApplicationExists(applicationId) {
    return applications.get(applicationId) ?? null;
  }

  function updateReportRun(reportRunId, updater) {
    const reportRun = reportRuns.get(reportRunId);

    if (!reportRun) {
      return null;
    }

    const nextReportRun = updater(reportRun);
    reportRuns.set(reportRunId, nextReportRun);

    return clone(nextReportRun);
  }

  function transitionReportRun(reportRunId, nextStatus, extraFields = {}) {
    const reportRun = reportRuns.get(reportRunId);

    if (!reportRun) {
      return null;
    }

    if (!allowedReportRunTransitions.get(reportRun.status).has(nextStatus)) {
      throw new Error(`Invalid report run transition from ${reportRun.status} to ${nextStatus}.`);
    }

    return updateReportRun(reportRunId, (currentReportRun) => ({
      ...currentReportRun,
      ...extraFields,
      status: nextStatus,
      updatedAt: createTimestamp()
    }));
  }

  function createScreenRecord(applicationId, screenInput, now) {
    return {
      id: randomUUID(),
      applicationId,
      name: screenInput.name,
      url: screenInput.url,
      createdAt: now,
      updatedAt: now
    };
  }

  function replaceApplicationScreens(applicationId, screenInputs) {
    const application = ensureApplicationExists(applicationId);

    if (!application) {
      return null;
    }

    const existingScreens = new Map(
      listProjectScreens(applicationId).map((screen) => [screen.id, screen])
    );
    const nextScreens = [];
    const now = createTimestamp();

    for (const screenInput of screenInputs) {
      if (screenInput.id) {
        const existingScreen = screens.get(screenInput.id);

        if (!existingScreen || existingScreen.applicationId !== applicationId) {
          throw new Error(`foreign_screen_id:${screenInput.id}`);
        }

        nextScreens.push({
          ...existingScreen,
          name: screenInput.name,
          url: screenInput.url,
          updatedAt: now
        });
        existingScreens.delete(screenInput.id);
        continue;
      }

      nextScreens.push(createScreenRecord(applicationId, screenInput, now));
    }

    for (const screen of existingScreens.values()) {
      screens.delete(screen.id);
    }

    for (const screen of nextScreens) {
      screens.set(screen.id, screen);
    }

    application.updatedAt = now;
    applications.set(application.id, application);

    return nextScreens.map(clone);
  }

  return {
    listProjects() {
      return Array.from(projects.values()).map(clone);
    },

    createProject(input) {
      const now = createTimestamp();
      const project = {
        id: randomUUID(),
        name: input.name,
        customerName: input.customerName,
        createdAt: now,
        updatedAt: now
      };

      projects.set(project.id, project);

      return clone(project);
    },

    getProjectById(projectId) {
      return projects.has(projectId) ? clone(projects.get(projectId)) : null;
    },

    updateProject(projectId, changes) {
      const project = projects.get(projectId);

      if (!project) {
        return null;
      }

      const updatedProject = {
        ...project,
        ...changes,
        updatedAt: createTimestamp()
      };

      projects.set(projectId, updatedProject);

      return clone(updatedProject);
    },

    listApplicationsByProject(projectId) {
      return Array.from(applications.values())
        .filter((application) => application.projectId === projectId)
        .map((application) => buildApplication(application));
    },

    createApplication(projectId, input) {
      const now = createTimestamp();
      const application = {
        id: randomUUID(),
        projectId,
        name: input.name,
        device: input.device,
        width: input.width,
        height: input.height,
        waitTimeMs: input.waitTimeMs,
        accessibilityTarget: clone(input.accessibilityTarget),
        createdAt: now,
        updatedAt: now
      };

      applications.set(application.id, application);

      if (input.screens) {
        replaceApplicationScreens(application.id, input.screens);
      }

      return buildApplication(application, { includeScreens: true });
    },

    getApplicationById(applicationId, options = {}) {
      const application = applications.get(applicationId);

      if (!application) {
        return null;
      }

      return buildApplication(application, options);
    },

    updateApplication(applicationId, changes) {
      const application = applications.get(applicationId);

      if (!application) {
        return null;
      }

      const nextApplication = {
        ...application,
        updatedAt: createTimestamp()
      };

      if (changes.name !== undefined) {
        nextApplication.name = changes.name;
      }

      if (changes.device !== undefined) {
        nextApplication.device = changes.device;
      }

      if (changes.width !== undefined) {
        nextApplication.width = changes.width;
      }

      if (changes.height !== undefined) {
        nextApplication.height = changes.height;
      }

      if (changes.waitTimeMs !== undefined) {
        nextApplication.waitTimeMs = changes.waitTimeMs;
      }

      if (changes.accessibilityTarget !== undefined) {
        nextApplication.accessibilityTarget = clone(changes.accessibilityTarget);
      }

      applications.set(applicationId, nextApplication);

      if (changes.screens !== undefined) {
        replaceApplicationScreens(applicationId, changes.screens);
      }

      return this.getApplicationById(applicationId, { includeScreens: true });
    },

    replaceApplicationScreens,

    getScreenById(screenId) {
      return screens.has(screenId) ? clone(screens.get(screenId)) : null;
    },

    listReportsByApplication(applicationId) {
      return Array.from(reports.values())
        .filter((report) => report.applicationId === applicationId)
        .map(sanitizeReport);
    },

    createReport(applicationId, input) {
      const now = createTimestamp();
      const report = {
        id: randomUUID(),
        applicationId,
        name: input.name,
        authenticationEnabled: input.authenticationEnabled,
        selectedScreenIds: clone(input.selectedScreenIds),
        createdAt: now,
        updatedAt: now
      };

      if (input.authenticationEnabled && input.authentication) {
        report.authentication = clone(input.authentication);
      }

      reports.set(report.id, report);

      return sanitizeReport(report);
    },

    getReportById(reportId) {
      const report = reports.get(reportId);

      if (!report) {
        return null;
      }

      return sanitizeReport(report);
    },

    updateReport(reportId, changes) {
      const report = reports.get(reportId);

      if (!report) {
        return null;
      }

      const nextReport = {
        ...report,
        updatedAt: createTimestamp()
      };

      if (changes.name !== undefined) {
        nextReport.name = changes.name;
      }

      if (changes.selectedScreenIds !== undefined) {
        nextReport.selectedScreenIds = clone(changes.selectedScreenIds);
      }

      if (changes.authenticationEnabled !== undefined) {
        nextReport.authenticationEnabled = changes.authenticationEnabled;
      }

      if (changes.authentication !== undefined) {
        nextReport.authentication = {
          ...(nextReport.authentication ?? {}),
          ...clone(changes.authentication)
        };
      }

      if (!nextReport.authenticationEnabled) {
        delete nextReport.authentication;
      }

      reports.set(reportId, nextReport);

      return sanitizeReport(nextReport);
    },

    listReportRunsByReport(reportId) {
      return Array.from(reportRuns.values())
        .filter((reportRun) => reportRun.reportId === reportId)
        .map(clone);
    },

    createReportRun(reportId, screensPlanned) {
      const now = createTimestamp();
      const reportRun = {
        id: randomUUID(),
        reportId,
        status: "pending",
        startedAt: null,
        finishedAt: null,
        errorMessage: null,
        summary: {
          totalFindings: 0,
          screensScanned: 0,
          screensPlanned,
          findingsByImpact: {}
        },
        createdAt: now,
        updatedAt: now
      };

      reportRuns.set(reportRun.id, reportRun);

      return clone(reportRun);
    },

    getReportRunById(reportRunId) {
      return reportRuns.has(reportRunId) ? clone(reportRuns.get(reportRunId)) : null;
    },

    startReportRun(reportRunId) {
      return transitionReportRun(reportRunId, "running", {
        startedAt: createTimestamp()
      });
    },

    updateReportRunSummary(reportRunId, summaryChanges) {
      return updateReportRun(reportRunId, (reportRun) => ({
        ...reportRun,
        summary: {
          ...reportRun.summary,
          ...clone(summaryChanges)
        },
        updatedAt: createTimestamp()
      }));
    },

    completeReportRun(reportRunId) {
      return transitionReportRun(reportRunId, "completed", {
        finishedAt: createTimestamp()
      });
    },

    failReportRun(reportRunId, errorMessage) {
      return transitionReportRun(reportRunId, "failed", {
        errorMessage,
        finishedAt: createTimestamp()
      });
    },

    createFindings(findingInputs) {
      const now = createTimestamp();

      return findingInputs.map((findingInput) => {
        const finding = {
          id: randomUUID(),
          ...clone(findingInput),
          createdAt: now
        };

        findings.set(finding.id, finding);

        return clone(finding);
      });
    },

    listFindingsByReportRun(reportRunId) {
      return Array.from(findings.values())
        .filter((finding) => finding.reportRunId === reportRunId)
        .map(clone);
    },

    getFindingById(findingId) {
      return findings.has(findingId) ? clone(findings.get(findingId)) : null;
    },

    listGuidelines() {
      return Array.from(guidelines.values()).map(clone);
    },

    getGuidelineById(guidelineId) {
      return guidelines.has(guidelineId) ? clone(guidelines.get(guidelineId)) : null;
    }
  };
}
