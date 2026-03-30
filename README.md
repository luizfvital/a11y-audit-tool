# Accessibility Audit Platform

Backend-first monorepo for an accessibility audit platform built around:

- a Node API
- a background worker for audit execution
- Playwright + axe-core scanning
- a shared OpenAPI contract and domain models

## Repository Structure

The repository follows the architecture described in [`docs/architecture.md`](docs/architecture.md).

```text
apps/
  api/         HTTP API and OpenAPI exposure
  worker/      background execution and orchestration

packages/
  audit-engine/  Playwright + axe-core execution logic
  contracts/     shared API schemas and domain contracts
  shared/        shared utilities and common code

tests/
  api/         API-focused validation tests
  fixtures/    test data and reusable fixtures

docs/          architecture, scope, and domain decisions
postman/       API exploration and manual test collections
openapi.yaml   source API contract
.env.example   local environment template
```

## Current Status

This repository currently focuses on contract-first backend design for the MVP.

The main artifacts available today are:

- [`openapi.yaml`](openapi.yaml): API contract with request/response examples
- [`docs/mvp-scope.md`](docs/mvp-scope.md): MVP scope and boundaries
- [`docs/architecture.md`](docs/architecture.md): system architecture and repository split
- [`docs/domain-model.md`](docs/domain-model.md): domain entities and relationships
- [`docs/report-run-lifecycle.md`](docs/report-run-lifecycle.md): report run state model

## Domain Overview

The MVP backend supports these core resources:

- Projects
- Applications
- Screens
- Reports
- ReportRuns
- Findings
- Guidelines

Typical flow:

1. Create a project
2. Create an application inside the project
3. Register screens
4. Create a report selecting screens
5. Trigger a report run
6. Retrieve run status and findings

## Accessibility Target Model

Applications are configured with a WCAG target using:

- `standard`: `WCAG`
- `version`: `2.0`, `2.1`, or `2.2`
- `levels`: one or more of `A`, `AA`, `AAA`

This keeps the contract explicit about WCAG version and supported conformance levels.

## API Contract

The API is documented in [`openapi.yaml`](openapi.yaml).

Useful starting points:

- browse the paths to understand the resource flow
- inspect the reusable examples for happy-path payloads
- review the shared error model and report run status responses

To visualize the API quickly, load [`openapi.yaml`](openapi.yaml) into Swagger Editor or Redoc.

## Local Configuration

Use [`.env.example`](.env.example) as the starting point for local environment setup.

The file contains placeholders for:

- API runtime settings
- worker execution settings
- Playwright configuration
- optional credentials
- persistence configuration

## Working Agreement

This repository is organized to keep responsibilities separated:

- `apps/api` owns HTTP and API behavior
- `apps/worker` owns asynchronous execution
- `packages/audit-engine` owns scan execution logic
- `packages/contracts` owns shared contract definitions
- `tests` owns validation coverage

That split is intentional so the project can scale without collapsing API, execution, and shared domain code into one package.

