export function createValidationError(details) {
  return {
    statusCode: 400,
    body: {
      error: {
        type: "validation_error",
        code: "invalid_request",
        message: "One or more request fields are invalid.",
        details
      }
    }
  };
}

export function createNotFoundError(resourceName, resourceId) {
  return {
    statusCode: 404,
    body: {
      error: {
        type: "execution_error",
        code: "resource_not_found",
        message: `${resourceName} ${resourceId} was not found.`
      }
    }
  };
}

export function sendError(response, error) {
  response.status(error.statusCode).json(error.body);
}
