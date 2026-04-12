import express from "express";
import swaggerUi from "swagger-ui-express";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import YAML from "yaml";
import { createNotFoundError, createValidationError, sendError } from "./errors.js";
import { createInMemoryRepository } from "./repository.js";
import {
  validateApplicationCreate,
  validateApplicationScreensReplace,
  validateApplicationUpdate,
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

export function createApp({ repository = createInMemoryRepository() } = {}) {
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
