import { randomUUID } from "node:crypto";

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

  function ensureApplicationExists(applicationId) {
    return applications.get(applicationId) ?? null;
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
    }
  };
}
