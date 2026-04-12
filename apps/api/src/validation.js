const DEVICE_VALUES = new Set(["desktop", "tablet", "phone"]);
const ACCESSIBILITY_STANDARDS = new Set(["WCAG"]);
const WCAG_VERSIONS = new Set(["2.0", "2.1", "2.2"]);
const WCAG_LEVELS = new Set(["A", "AA", "AAA"]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function isValidUri(value) {
  if (typeof value !== "string") {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isUuid(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function validateAccessibilityTarget(accessibilityTarget, fieldPrefix = "accessibilityTarget") {
  const details = [];

  if (!isPlainObject(accessibilityTarget)) {
    details.push({
      field: fieldPrefix,
      issue: "must be an object"
    });
    return details;
  }

  if (!ACCESSIBILITY_STANDARDS.has(accessibilityTarget.standard)) {
    details.push({
      field: `${fieldPrefix}.standard`,
      issue: "must be WCAG"
    });
  }

  if (!WCAG_VERSIONS.has(accessibilityTarget.version)) {
    details.push({
      field: `${fieldPrefix}.version`,
      issue: "must be one of 2.0, 2.1, or 2.2"
    });
  }

  if (!Array.isArray(accessibilityTarget.levels) || accessibilityTarget.levels.length === 0) {
    details.push({
      field: `${fieldPrefix}.levels`,
      issue: "must include at least one level"
    });
    return details;
  }

  const uniqueLevels = new Set(accessibilityTarget.levels);

  if (uniqueLevels.size !== accessibilityTarget.levels.length) {
    details.push({
      field: `${fieldPrefix}.levels`,
      issue: "must not contain duplicate levels"
    });
  }

  accessibilityTarget.levels.forEach((level, index) => {
    if (!WCAG_LEVELS.has(level)) {
      details.push({
        field: `${fieldPrefix}.levels[${index}]`,
        issue: "must be one of A, AA, or AAA"
      });
    }
  });

  return details;
}

function validateScreens(screens, fieldName = "screens") {
  const details = [];

  if (!Array.isArray(screens)) {
    details.push({
      field: fieldName,
      issue: "must be an array"
    });
    return details;
  }

  screens.forEach((screen, index) => {
    const prefix = `${fieldName}[${index}]`;

    if (!isPlainObject(screen)) {
      details.push({
        field: prefix,
        issue: "must be an object"
      });
      return;
    }

    if (screen.id !== undefined && !isUuid(screen.id)) {
      details.push({
        field: `${prefix}.id`,
        issue: "must be a valid UUID"
      });
    }

    if (!isNonEmptyString(screen.name)) {
      details.push({
        field: `${prefix}.name`,
        issue: "must not be empty"
      });
    }

    if (!isValidUri(screen.url)) {
      details.push({
        field: `${prefix}.url`,
        issue: "must be a valid URI"
      });
    }
  });

  return details;
}

function validateSelectedScreenIds(selectedScreenIds, fieldName = "selectedScreenIds") {
  const details = [];

  if (!Array.isArray(selectedScreenIds)) {
    details.push({
      field: fieldName,
      issue: "must be an array"
    });
    return details;
  }

  if (selectedScreenIds.length === 0) {
    details.push({
      field: fieldName,
      issue: "must include at least one screen id"
    });
    return details;
  }

  selectedScreenIds.forEach((screenId, index) => {
    if (!isUuid(screenId)) {
      details.push({
        field: `${fieldName}[${index}]`,
        issue: "must be a valid UUID"
      });
    }
  });

  return details;
}

function validateAuthentication(authentication, { required }) {
  const details = [];

  if (authentication === undefined) {
    if (required) {
      details.push({
        field: "authentication.loginUrl",
        issue: "is required when authenticationEnabled is true"
      });
      details.push({
        field: "authentication.username",
        issue: "is required when authenticationEnabled is true"
      });
    }

    return details;
  }

  if (!isPlainObject(authentication)) {
    details.push({
      field: "authentication",
      issue: "must be an object"
    });
    return details;
  }

  if (required && authentication.loginUrl === undefined) {
    details.push({
      field: "authentication.loginUrl",
      issue: "is required when authenticationEnabled is true"
    });
  } else if (authentication.loginUrl !== undefined && !isValidUri(authentication.loginUrl)) {
    details.push({
      field: "authentication.loginUrl",
      issue: "must be a valid URI"
    });
  }

  if (required && authentication.username === undefined) {
    details.push({
      field: "authentication.username",
      issue: "is required when authenticationEnabled is true"
    });
  } else if (authentication.username !== undefined && !isNonEmptyString(authentication.username)) {
    details.push({
      field: "authentication.username",
      issue: "must not be empty"
    });
  }

  if (authentication.password !== undefined && !isNonEmptyString(authentication.password)) {
    details.push({
      field: "authentication.password",
      issue: "must not be empty"
    });
  }

  return details;
}

function validateBodyHasAllowedFields(body, allowedFields, issue) {
  if (!isPlainObject(body)) {
    return [
      {
        field: "body",
        issue: "must be an object"
      }
    ];
  }

  if (Object.keys(body).length === 0) {
    return [
      {
        field: "body",
        issue
      }
    ];
  }

  if (!Object.keys(body).some((field) => allowedFields.includes(field))) {
    return [
      {
        field: "body",
        issue
      }
    ];
  }

  return [];
}

export function validateProjectCreate(body) {
  const details = [];

  if (!isPlainObject(body)) {
    return [
      {
        field: "body",
        issue: "must be an object"
      }
    ];
  }

  if (!isNonEmptyString(body.name)) {
    details.push({
      field: "name",
      issue: "must not be empty"
    });
  }

  if (!isNonEmptyString(body.customerName)) {
    details.push({
      field: "customerName",
      issue: "must not be empty"
    });
  }

  return details;
}

export function validateProjectUpdate(body) {
  const details = validateBodyHasAllowedFields(
    body,
    ["name", "customerName"],
    "must include at least one of name or customerName"
  );

  if (details.length > 0 || !isPlainObject(body)) {
    return details;
  }

  if (body.name !== undefined && !isNonEmptyString(body.name)) {
    details.push({
      field: "name",
      issue: "must not be empty"
    });
  }

  if (body.customerName !== undefined && !isNonEmptyString(body.customerName)) {
    details.push({
      field: "customerName",
      issue: "must not be empty"
    });
  }

  return details;
}

function validateApplicationBase(body, { partial }) {
  const details = [];

  if (!isPlainObject(body)) {
    return [
      {
        field: "body",
        issue: "must be an object"
      }
    ];
  }

  const requiredFields = [
    "name",
    "device",
    "width",
    "height",
    "waitTimeMs",
    "accessibilityTarget"
  ];

  if (!partial) {
    for (const field of requiredFields) {
      if (body[field] === undefined) {
        details.push({
          field,
          issue: "is required"
        });
      }
    }
  }

  if (!partial || body.name !== undefined) {
    if (!isNonEmptyString(body.name)) {
      details.push({
        field: "name",
        issue: "must not be empty"
      });
    }
  }

  if (!partial || body.device !== undefined) {
    if (!DEVICE_VALUES.has(body.device)) {
      details.push({
        field: "device",
        issue: "must be one of desktop, tablet, or phone"
      });
    }
  }

  if (!partial || body.width !== undefined) {
    if (!isPositiveInteger(body.width)) {
      details.push({
        field: "width",
        issue: "must be greater than 0"
      });
    }
  }

  if (!partial || body.height !== undefined) {
    if (!isPositiveInteger(body.height)) {
      details.push({
        field: "height",
        issue: "must be greater than 0"
      });
    }
  }

  if (!partial || body.waitTimeMs !== undefined) {
    if (!isNonNegativeInteger(body.waitTimeMs)) {
      details.push({
        field: "waitTimeMs",
        issue: "must be greater than or equal to 0"
      });
    }
  }

  if (!partial || body.accessibilityTarget !== undefined) {
    details.push(...validateAccessibilityTarget(body.accessibilityTarget));
  }

  if (body.screens !== undefined) {
    details.push(...validateScreens(body.screens));
  }

  return details;
}

export function validateApplicationCreate(body) {
  return validateApplicationBase(body, { partial: false });
}

export function validateApplicationUpdate(body) {
  const details = validateBodyHasAllowedFields(
    body,
    ["name", "device", "width", "height", "waitTimeMs", "accessibilityTarget", "screens"],
    "must include at least one application field"
  );

  if (details.length > 0 || !isPlainObject(body)) {
    return details;
  }

  return validateApplicationBase(body, { partial: true });
}

export function validateApplicationScreensReplace(body) {
  if (!isPlainObject(body)) {
    return [
      {
        field: "body",
        issue: "must be an object"
      }
    ];
  }

  if (body.screens === undefined) {
    return [
      {
        field: "screens",
        issue: "is required"
      }
    ];
  }

  return validateScreens(body.screens);
}

export function validateReportCreate(body) {
  const details = [];

  if (!isPlainObject(body)) {
    return [
      {
        field: "body",
        issue: "must be an object"
      }
    ];
  }

  if (!isNonEmptyString(body.name)) {
    details.push({
      field: "name",
      issue: "must not be empty"
    });
  }

  if (typeof body.authenticationEnabled !== "boolean") {
    details.push({
      field: "authenticationEnabled",
      issue: "must be a boolean"
    });
  }

  details.push(...validateSelectedScreenIds(body.selectedScreenIds));

  const requiresAuthentication = body.authenticationEnabled === true;
  details.push(...validateAuthentication(body.authentication, { required: requiresAuthentication }));

  return details;
}

export function validateReportUpdate(body, existingReport) {
  const details = validateBodyHasAllowedFields(
    body,
    ["name", "authenticationEnabled", "authentication", "selectedScreenIds"],
    "must include at least one report field"
  );

  if (details.length > 0 || !isPlainObject(body)) {
    return details;
  }

  if (body.name !== undefined && !isNonEmptyString(body.name)) {
    details.push({
      field: "name",
      issue: "must not be empty"
    });
  }

  if (body.authenticationEnabled !== undefined && typeof body.authenticationEnabled !== "boolean") {
    details.push({
      field: "authenticationEnabled",
      issue: "must be a boolean"
    });
  }

  if (body.selectedScreenIds !== undefined) {
    details.push(...validateSelectedScreenIds(body.selectedScreenIds));
  }

  const effectiveAuthenticationEnabled =
    body.authenticationEnabled ?? existingReport?.authenticationEnabled ?? false;

  if (effectiveAuthenticationEnabled) {
    const effectiveAuthentication = body.authentication === undefined
      ? existingReport?.authentication
      : {
          ...(existingReport?.authentication ?? {}),
          ...body.authentication
        };

    details.push(...validateAuthentication(effectiveAuthentication, { required: true }));
  } else if (body.authentication !== undefined) {
    details.push(...validateAuthentication(body.authentication, { required: false }));
  }

  return details;
}
