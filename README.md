# Accessibility Audit Platform

Backend-first monorepo for an accessibility audit platform built around:

- a Node API
- an OpenAPI contract
- an incremental MVP build approach

## Repository Structure

The repository follows the MVP specification described in [`docs/mvp-spec.md`](docs/mvp-spec.md).

```text
apps/
  api/         HTTP API and OpenAPI exposure
  worker/      placeholder for future background execution

packages/
  audit-engine/  placeholder for future Playwright + axe-core execution logic
  contracts/     placeholder for future shared API/domain contracts
  shared/        placeholder for future shared utilities

tests/
  api/         API-focused validation tests
  fixtures/    test data and reusable fixtures

docs/          project specifications and working agreements
postman/       API exploration and manual test collections
openapi.yaml   source API contract
```

## Current Status

This repository currently focuses on contract-first backend design for the MVP.

The main artifacts available today are:

- [`openapi.yaml`](openapi.yaml): API contract with request/response examples
- [`docs/mvp-spec.md`](docs/mvp-spec.md): canonical MVP scope, architecture, domain model, lifecycle, and execution flow
- [`apps/api`](apps/api): Express API with health, project, application, report, report-run, finding, and guideline endpoints
- [`tests/api`](tests/api): automated coverage for the implemented API slice

Current implementation note:

- report execution now runs in-process with Playwright and `@axe-core/playwright`
- this first runner slice is fixture-only and supports reserved local fixture URLs, not arbitrary application URLs yet
- authentication configuration is stored on reports, but authenticated scanning is still deferred

Current MVP snapshot:

- implemented API resources: projects, applications, screens, reports, report runs, findings, and guidelines
- implemented execution model: in-process sequential runner inside `apps/api`
- implemented scan target support: reserved fixture URLs only
- implemented findings model: normalized findings linked to report runs, screens, and guideline records
- not implemented yet: authenticated scanning, arbitrary real-world URL execution, worker extraction, PostgreSQL persistence, and advanced reporting

Supported fixture URLs:

- `http://fixtures.a11y.local/basic-violations`
  - happy-path fixture
  - produces mapped accessibility findings and should complete the run
- `http://fixtures.a11y.local/unmapped-rule`
  - failure-path fixture
  - produces an unmapped axe rule and should fail the run

Next recommended slice:

- expand the runner from fixture-only execution to controlled real URL execution
- introduce a clear execution boundary so the runner can later move from `apps/api` into `apps/worker`
- keep the current API contract stable while improving runtime capabilities

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
3. Manage application screens
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

Practical rule for future sessions:

- [`README.md`](README.md): current status and how to run or test the project
- [`docs/mvp-spec.md`](docs/mvp-spec.md): product scope, architecture, and next-step direction
- [`openapi.yaml`](openapi.yaml): exact API contract, payload shapes, and response behavior

Useful starting points:

- browse the paths to understand the resource flow
- inspect the reusable examples for happy-path payloads
- review the shared error model and report run status responses

To visualize the API quickly, load [`openapi.yaml`](openapi.yaml) into Swagger Editor or Redoc.

## Local Usage

Run the implemented API and tests with:

- `npm run dev:api`
- `npm run start:api`
- `npm run test:api`

If Playwright browsers are not installed yet, run:

- `npx playwright install chromium`

## Working Agreement

This repository is organized to keep responsibilities separated:

- `apps/api` owns HTTP and API behavior
- `apps/worker` is reserved for future asynchronous execution
- `packages/audit-engine` is reserved for future scan execution logic
- `packages/contracts` is reserved for future shared contract definitions
- `tests` owns validation coverage

That split is intentional so the project can scale without collapsing API, execution, and shared domain code into one package.
