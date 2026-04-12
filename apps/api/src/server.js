import express from "express";
import swaggerUi from "swagger-ui-express";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import YAML from "yaml";
import { createAuditRunner } from "./audit-runner.js";
import { createNotFoundError, createValidationError, sendError } from "./errors.js";
import { createInMemoryRepository } from "./repository.js";
import {
  validateApplicationCreate,
  validateApplicationScreensReplace,
  validateApplicationUpdate,
  validateReportCreate,
  validateReportUpdate,
  validateProjectCreate,
  validateProjectUpdate
} from "./validation.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");
const openApiPath = path.join(repoRoot, "openapi.yaml");
const port = Number(process.env.PORT || 3000);
const openApiDocument = YAML.parse(readFileSync(openApiPath, "utf8"));

function sendData(response, statusCode, data) {
  response.status(statusCode).json({ data });
}

function sendValidationError(response, details) {
  sendError(response, createValidationError(details));
}

function sendNotFoundError(response, resourceName, resourceId) {
  sendError(response, createNotFoundError(resourceName, resourceId));
}

function validateSelectedScreensBelongToApplication(repository, applicationId, selectedScreenIds) {
  if (!selectedScreenIds) {
    return [];
  }

  const details = [];

  selectedScreenIds.forEach((screenId, index) => {
    const screen = repository.getScreenById(screenId);

    if (!screen || screen.applicationId !== applicationId) {
      details.push({
        field: `selectedScreenIds[${index}]`,
        issue: `screen ${screenId} does not belong to application ${applicationId}`
      });
    }
  });

  return details;
}

export function createApp({ repository = createInMemoryRepository() } = {}) {
  const auditRunner = createAuditRunner({ repository });
  const app = express();

  app.use(express.json());

  app.get("/health", (_request, response) => {
    response.json({
      status: "ok"
    });
  });

  app.get("/openapi.yaml", (_request, response) => {
    response.type("application/yaml").send(readFileSync(openApiPath, "utf8"));
  });

  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument, {
    explorer: true
  }));

  app.get("/projects", (_request, response) => {
    sendData(response, 200, repository.listProjects());
  });

  app.post("/projects", (request, response) => {
    const details = validateProjectCreate(request.body);

    if (details.length > 0) {
      return sendValidationError(response, details);
    }

    return sendData(response, 201, repository.createProject(request.body));
  });

  app.get("/projects/:projectId", (request, response) => {
    const project = repository.getProjectById(request.params.projectId);

    if (!project) {
      return sendNotFoundError(response, "Project", request.params.projectId);
    }

    return sendData(response, 200, project);
  });

  app.patch("/projects/:projectId", (request, response) => {
    const details = validateProjectUpdate(request.body);

    if (details.length > 0) {
      return sendValidationError(response, details);
    }

    const project = repository.updateProject(request.params.projectId, request.body);

    if (!project) {
      return sendNotFoundError(response, "Project", request.params.projectId);
    }

    return sendData(response, 200, project);
  });

  app.get("/projects/:projectId/applications", (request, response) => {
    const project = repository.getProjectById(request.params.projectId);

    if (!project) {
      return sendNotFoundError(response, "Project", request.params.projectId);
    }

    return sendData(response, 200, repository.listApplicationsByProject(request.params.projectId));
  });

  app.post("/projects/:projectId/applications", (request, response) => {
    const details = validateApplicationCreate(request.body);

    if (details.length > 0) {
      return sendValidationError(response, details);
    }

    const project = repository.getProjectById(request.params.projectId);

    if (!project) {
      return sendNotFoundError(response, "Project", request.params.projectId);
    }

    try {
      return sendData(response, 201, repository.createApplication(request.params.projectId, request.body));
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("foreign_screen_id:")) {
        const [, screenId] = error.message.split(":");
        return sendValidationError(response, [
          {
            field: "screens",
            issue: `contains screen id ${screenId} that does not belong to this application`
          }
        ]);
      }

      throw error;
    }
  });

  app.get("/applications/:applicationId", (request, response) => {
    const application = repository.getApplicationById(request.params.applicationId, {
      includeScreens: true
    });

    if (!application) {
      return sendNotFoundError(response, "Application", request.params.applicationId);
    }

    return sendData(response, 200, application);
  });

  app.patch("/applications/:applicationId", (request, response) => {
    const details = validateApplicationUpdate(request.body);

    if (details.length > 0) {
      return sendValidationError(response, details);
    }

    try {
      const application = repository.updateApplication(request.params.applicationId, request.body);

      if (!application) {
        return sendNotFoundError(response, "Application", request.params.applicationId);
      }

      return sendData(response, 200, application);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("foreign_screen_id:")) {
        const [, screenId] = error.message.split(":");
        return sendValidationError(response, [
          {
            field: "screens",
            issue: `contains screen id ${screenId} that does not belong to this application`
          }
        ]);
      }

      throw error;
    }
  });

  app.put("/applications/:applicationId/screens", (request, response) => {
    const details = validateApplicationScreensReplace(request.body);

    if (details.length > 0) {
      return sendValidationError(response, details);
    }

    try {
      const screens = repository.replaceApplicationScreens(
        request.params.applicationId,
        request.body.screens
      );

      if (!screens) {
        return sendNotFoundError(response, "Application", request.params.applicationId);
      }

      return sendData(response, 200, screens);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("foreign_screen_id:")) {
        const [, screenId] = error.message.split(":");
        return sendValidationError(response, [
          {
            field: "screens",
            issue: `contains screen id ${screenId} that does not belong to this application`
          }
        ]);
      }

      throw error;
    }
  });

  app.get("/applications/:applicationId/reports", (request, response) => {
    const application = repository.getApplicationById(request.params.applicationId);

    if (!application) {
      return sendNotFoundError(response, "Application", request.params.applicationId);
    }

    return sendData(response, 200, repository.listReportsByApplication(request.params.applicationId));
  });

  app.post("/applications/:applicationId/reports", (request, response) => {
    const details = validateReportCreate(request.body);

    if (details.length > 0) {
      return sendValidationError(response, details);
    }

    const application = repository.getApplicationById(request.params.applicationId);

    if (!application) {
      return sendNotFoundError(response, "Application", request.params.applicationId);
    }

    const selectedScreenDetails = validateSelectedScreensBelongToApplication(
      repository,
      request.params.applicationId,
      request.body.selectedScreenIds
    );

    if (selectedScreenDetails.length > 0) {
      return sendValidationError(response, selectedScreenDetails);
    }

    return sendData(response, 201, repository.createReport(request.params.applicationId, request.body));
  });

  app.get("/reports/:reportId", (request, response) => {
    const report = repository.getReportById(request.params.reportId);

    if (!report) {
      return sendNotFoundError(response, "Report", request.params.reportId);
    }

    return sendData(response, 200, report);
  });

  app.patch("/reports/:reportId", (request, response) => {
    const existingReport = repository.getReportById(request.params.reportId);

    if (!existingReport) {
      return sendNotFoundError(response, "Report", request.params.reportId);
    }

    const details = validateReportUpdate(request.body, existingReport);

    if (details.length > 0) {
      return sendValidationError(response, details);
    }

    if (request.body.selectedScreenIds !== undefined) {
      const selectedScreenDetails = validateSelectedScreensBelongToApplication(
        repository,
        existingReport.applicationId,
        request.body.selectedScreenIds
      );

      if (selectedScreenDetails.length > 0) {
        return sendValidationError(response, selectedScreenDetails);
      }
    }

    return sendData(response, 200, repository.updateReport(request.params.reportId, request.body));
  });

  app.get("/reports/:reportId/report-runs", (request, response) => {
    const report = repository.getReportById(request.params.reportId);

    if (!report) {
      return sendNotFoundError(response, "Report", request.params.reportId);
    }

    return sendData(response, 200, repository.listReportRunsByReport(request.params.reportId));
  });

  app.post("/reports/:reportId/report-runs", (request, response) => {
    const report = repository.getReportById(request.params.reportId);

    if (!report) {
      return sendNotFoundError(response, "Report", request.params.reportId);
    }

    const reportRun = repository.createReportRun(
      request.params.reportId,
      report.selectedScreenIds.length
    );

    sendData(response, 201, reportRun);

    setImmediate(() => {
      auditRunner.executeReportRun(reportRun.id).catch((error) => {
        console.error("Failed to execute report run", error);
      });
    });
  });

  app.get("/report-runs/:reportRunId", (request, response) => {
    const reportRun = repository.getReportRunById(request.params.reportRunId);

    if (!reportRun) {
      return sendNotFoundError(response, "Report run", request.params.reportRunId);
    }

    return sendData(response, 200, reportRun);
  });

  app.get("/report-runs/:reportRunId/findings", (request, response) => {
    const reportRun = repository.getReportRunById(request.params.reportRunId);

    if (!reportRun) {
      return sendNotFoundError(response, "Report run", request.params.reportRunId);
    }

    return sendData(response, 200, repository.listFindingsByReportRun(request.params.reportRunId));
  });

  app.get("/findings/:findingId", (request, response) => {
    const finding = repository.getFindingById(request.params.findingId);

    if (!finding) {
      return sendNotFoundError(response, "Finding", request.params.findingId);
    }

    return sendData(response, 200, finding);
  });

  app.get("/guidelines", (_request, response) => {
    return sendData(response, 200, repository.listGuidelines());
  });

  app.get("/guidelines/:guidelineId", (request, response) => {
    const guideline = repository.getGuidelineById(request.params.guidelineId);

    if (!guideline) {
      return sendNotFoundError(response, "Guideline", request.params.guidelineId);
    }

    return sendData(response, 200, guideline);
  });

  return app;
}

export const app = createApp();

export function startServer(listenPort = port) {
  return app.listen(listenPort, () => {
    console.log(`API listening on http://localhost:${listenPort}`);
    console.log(`Health endpoint available at http://localhost:${listenPort}/health`);
    console.log(`Swagger UI available at http://localhost:${listenPort}/docs`);
  });
}

const isEntrypoint = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  startServer();
}
