# Accessibility Audit Platform — System Architecture

## Overview

The Accessibility Audit Platform is a backend-first system designed to perform automated accessibility audits on web applications using Playwright and axe-core.

The architecture separates:

- API contract
- audit execution
- domain normalization
- persistence and infrastructure

This allows the backend to be validated independently from any specific client implementation.

For the MVP, the backend is also the system of record for the audit domain.

## High-Level Architecture

```text
Client Application or Integration (future)
        │
        │ REST API
        ▼
Node Backend API
        │
        │ create/read/update audit resources
        │
        │ triggers audit jobs
        ▼
Audit Runner
        │
        │ browser automation
        ▼
Playwright + axe-core
        │
        │ normalized results
        ▼
Persistence / Retrieval Layer
```
## Main Architectural Decision

The platform is API-first: audit execution, normalization, and result retrieval live in the backend, while any future client consumes the same REST contract.

The backend platform owns both:
- the audit domain resources such as projects, applications, screens, reports, report runs, findings, and guidelines
- the audit execution flow that produces normalized results

## Why

An API-first design is a strong fit for:
- frontend agnosticism
- stable integration contracts
- independent evolution of clients and backend services
- early validation through Swagger, Postman, and automated tests

Node is a strong fit for:
- Playwright execution
- axe-core integration
- browser automation
- long-running scan jobs

This means the system is intentionally split into:
- client applications or integrations as API consumers
- Node as the audit-domain, execution, and normalization backend

## System Components

1. Client Applications and Integrations (Future)

Any future frontend or integration can consume the backend through REST APIs.

Responsibilities:
- provide UI or integration flows to create and edit projects, applications, screens, and reports through the API
- trigger report runs through the API
- read findings, summaries, and guideline data through the API
- filter and explore audit results
- present future dashboards and history views

2. Node Backend API

The backend API will be implemented in Node.js.

Responsibilities:
- expose REST endpoints
- validate requests
- create, read, and update audit-domain resources
- receive report run requests
- persist domain data
- orchestrate audit execution
- return run status
- return normalized findings and summaries
- expose Swagger / OpenAPI documentation

The API is the entry point for audit-related operations.

3. Audit Runner

The audit runner is responsible for performing the actual accessibility scans.

Responsibilities:
- launch browser instances
- apply viewport configuration
- navigate to target URLs
- authenticate when required
- wait for page readiness
- execute axe-core
- collect findings
- normalize results

At the beginning, the audit runner may live inside the same Node application as the API.

Later, it can be extracted into a separate worker service.

4. Audit Engine

The audit engine combines two technologies:
- Playwright
- axe-core

Playwright is responsible for:
- browser automation
- page navigation
- login flows
- DOM interaction
- viewport simulation

axe-core is responsible for:
- accessibility analysis
- identifying rule violations
- producing machine-readable findings

5. Data Storage Strategy

The backend owns persistence for the audit domain in the MVP.

This means the backend, not the client, is the system of record for:
- Projects
- Applications
- Screens
- Reports
- ReportRuns
- Guidelines
- Findings

The MVP should store this data in a backend-owned relational database.

PostgreSQL is the recommended persistence technology for the MVP.

The persistence layer exists to support the normalized API contract and the resource model exposed by the platform.

Summarized metrics for reporting may also be stored or derived from this same backend-owned data.

Future persistence changes may be possible, but storage replacement is not an MVP goal. The important MVP requirement is that persistence concerns remain reasonably isolated from API contract and audit execution logic so the implementation can evolve later if needed.

## Domain Model

```text
Project
   │
   └── Application
         │
         ├── Screen
         │
         └── Report
               ├── selects Screens
               │
               └── ReportRun
                     │
                     └── Finding
                           ├── references Screen
                           └── references Guideline
```
## Entity Summary

### Project
Represents a business initiative or client project.

### Application
Represents an audited application inside a project.

Stores configuration such as:
- accessibility target level
- device type
- viewport width
- viewport height
- wait time

### Screen
Represents a named page or URL that can be audited.

### Report
Represents a reusable scan definition for an application.

A report is a configuration object. It selects one or more screens and can be executed multiple times.

The screen selection is modeled as a many-to-many relationship, even if the join is not exposed as a first-class API resource.

### ReportRun
Represents one execution of a report.

Tracks lifecycle state such as:
- pending
- running
- completed
- failed

### Guideline
Represents an accessibility rule or success criterion referenced by findings.

### Finding
Represents a normalized accessibility issue produced by axe-core.

Each finding belongs to a report run and references both the originating screen and the related guideline.

## Report Execution Flow

```text
1. User creates project
2. User creates application
3. User registers screens
4. User creates report
5. User triggers report run
6. Backend receives request
7. Audit runner launches browser
8. Target pages are loaded
9. axe-core scans each page
10. Results are normalized
11. Findings are returned and/or stored
12. Report run is marked completed or failed
```

## API Design Principles

The backend follows a resource-oriented API structure.

Main MVP resource groups:
- `Projects`
- `Applications`
- `Screens`
- `Reports`
- `ReportRuns`
- `Findings`

Supporting reference resource:
- `Guidelines`

### Resource Responsibilities

#### Projects
Top-level business container.

Responsibility:
- organize audited work by customer initiative
- own applications

#### Applications
Audit target and runtime configuration boundary.

Responsibility:
- belong to one project
- store audit execution defaults such as device, viewport, wait time, and accessibility target
- own screens and reports

#### Screens
Auditable URLs inside one application.

Responsibility:
- store screen name and URL
- act as selectable audit targets for reports

#### Reports
Reusable audit definitions.

Responsibility:
- belong to one application
- define which screens are selected for execution
- optionally store authentication configuration
- act as the parent resource from which report runs are created

The `ReportScreen` relationship exists in the domain model, but it does not need to be exposed as a first-class API resource in the MVP. Screen selection can be managed inside the `Report` payload.

#### ReportRuns
Execution instances of reports.

Responsibility:
- represent one triggered execution of one report
- expose lifecycle state and timestamps
- expose run summary data
- provide the retrieval boundary for findings

`ReportRuns` are execution resources, not configuration resources.

#### Findings
Normalized accessibility issues produced by a specific report run.

Responsibility:
- expose normalized scan results
- link each issue to its run, screen, and guideline
- remain read-only in the MVP

Findings should not be created or updated directly by API clients. They are produced only through report execution.

#### Guidelines
Reference data used to classify findings.

Responsibility:
- provide stable rule metadata for findings
- support read-only lookup and enrichment

### Naming Rules

To keep the API predictable, the MVP should use these conventions consistently:
- plural resource names in URLs
- kebab-case path segments
- avoid mixing domain names and shorthand aliases such as `/runs`
- use `report-runs` in URLs to match the domain term `ReportRun`
- use nested routes when the parent-child relationship is part of the resource identity

Examples:
- `/projects/{projectId}/applications`
- `/applications/{applicationId}/screens`
- `/applications/{applicationId}/reports`
- `/reports/{reportId}/report-runs`
- `/report-runs/{reportRunId}/findings`

### Recommended MVP Endpoint Groups

```text
Projects
POST /projects
GET /projects
GET /projects/{projectId}
PATCH /projects/{projectId}

Applications
POST /projects/{projectId}/applications
GET /projects/{projectId}/applications
GET /applications/{applicationId}
PATCH /applications/{applicationId}

Screens
POST /applications/{applicationId}/screens
GET /applications/{applicationId}/screens
GET /screens/{screenId}
PATCH /screens/{screenId}

Reports
POST /applications/{applicationId}/reports
GET /applications/{applicationId}/reports
GET /reports/{reportId}
PATCH /reports/{reportId}

ReportRuns
POST /reports/{reportId}/report-runs
GET /reports/{reportId}/report-runs
GET /report-runs/{reportRunId}

Findings
GET /report-runs/{reportRunId}/findings
GET /findings/{findingId}

Guidelines
GET /guidelines
GET /guidelines/{guidelineId}
```

### Why These Endpoints Support the MVP Flow

The MVP flow is:

`Project -> Application -> Screen -> Report -> ReportRun -> Finding`

This structure supports that flow directly:
- create a project first
- create applications under a project
- register screens under an application
- create reports under an application with selected screen IDs
- trigger execution by creating a `ReportRun` under a report
- retrieve run status through `GET /report-runs/{reportRunId}`
- retrieve normalized findings through `GET /report-runs/{reportRunId}/findings`

### Endpoint Decisions

`ReportRuns` needs explicit endpoints in the MVP because execution state must be created and queried independently from `Reports`.

`Findings` also needs explicit endpoints in the MVP because retrieving normalized results is one of the core validation goals.

However:
- `ReportRuns` should be created only from a report context
- `Findings` should be read-only
- `ReportScreen` should remain an internal relationship, not a separate MVP resource group

The API contract will be defined using OpenAPI and explored through Swagger UI.

Swagger examples should reinforce the intended resource flow by reusing one connected MVP dataset across projects, applications, screens, reports, report runs, findings, and guidelines.

Error examples should be attached at the operation level when possible, so nested resources and validation failures describe the correct parent resource, field set, or execution failure.

## Development-Time Architecture

For the validation phase, the system can start with a simple shape:
```text
Swagger UI / Postman
        │
        ▼
Dockerized Node Backend
        ├── API layer
        ├── Audit runner
        └── persistence access
                │
                ▼
PostgreSQL
```
This allows backend validation before any dedicated client application exists.

## Future Production-Oriented Architecture

```text
Client Application or Integration
        │
        ▼
Node API
   ├── PostgreSQL
   └── Job Queue
           │
           ▼
   One or More Audit Workers
           │
           ▼
   Playwright + axe-core
```
This evolution allows long-running scans to be separated from normal API traffic.

## Repository-Level Architecture

Recommended repository structure:
```text
apps/
  api/
  worker/

packages/
  audit-engine/
  contracts/
  shared/

tests/
  api/
  fixtures/

docs/
postman/
openapi.yaml
docker-compose.yml
```

### Responsibility Split
- apps/api owns HTTP and API exposure
- apps/worker owns background execution
- packages/audit-engine owns Playwright + axe logic
- packages/contracts owns shared schemas and models
- tests/ owns validation

## Containerization Strategy

The backend will run in Docker containers.

Benefits:
- consistent local setup
- reliable Playwright environment
- easier CI execution
- easier future scaling

Containers should include:
- Node runtime
- Playwright dependencies
- browser runtime support
- PostgreSQL connectivity

## Testing Strategy

The validation process includes multiple layers.

1. Swagger UI

Used as a temporary interactive API client for manual exploration.

2. Postman

Used for full end-to-end manual validation flows.

3. Playwright API Tests

Used to automate API validation.

4. Real Audit Validation

Used to confirm that Playwright and axe-core work correctly on real pages.

## Scalability Strategy

The project should start as simply as possible, but with a structure that supports future scaling.

Initial approach
- single Node backend
- audit runner inside same service
- sequential execution

Future approach
- separate API and worker
- queue-based execution
- multiple workers
- parallel report processing when needed

This keeps the MVP simple while preserving a path for growth.

## Security Considerations

Important concerns include:
- secure handling of authentication credentials
- isolation of browser execution
- safe Docker configuration
- controlled access to internal environments being audited

These concerns are especially important once authenticated application scanning is introduced.

## Technology Stack

Client applications (future) -> any REST-capable frontend or integration

Backend API -> Node.js

MVP database -> PostgreSQL

Browser automation -> Playwright

Accessibility engine -> axe-core

API documentation -> OpenAPI / Swagger

Containerization -> Docker

Manual API validation -> Swagger UI / Postman

Automated API validation -> Playwright API tests

## Future Enhancements

Potential future improvements include:
- authenticated application scanning
- report history comparison
- trend analysis
- export functionality
- scheduled scans
- CI integration
- multiple worker execution
- issue lifecycle management

## Project Goal

The main goal of this platform is to provide normalized accessibility audit results through a stable API, so any client can build workflows, reporting, or remediation experiences on top of the same backend contract.
