# Accessibility Audit Platform — System Architecture

## Overview

The Accessibility Audit Platform is a backend-first system designed to perform automated accessibility audits on web applications using Playwright and axe-core.

The architecture separates:

- API layer
- audit execution
- domain logic
- infrastructure

This allows the backend to be validated independently before the frontend, which will later be implemented in OutSystems.

## High-Level Architecture

```text
OutSystems Frontend (future)
        │
        │ REST API
        ▼
Node Backend API
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
OutSystems-managed data storage / reporting layer
```
## Main Architectural Decision

The main application will be built in OutSystems, but the audit execution layer will live outside OutSystems.

## Why

OutSystems is a strong fit for:
- business workflows
- relational data
- report management
- UI and dashboards
- internal tooling

Node is a strong fit for:
- Playwright execution
- axe-core integration
- browser automation
- long-running scan jobs

This means the system is intentionally split into:
- OutSystems as the product application
- Node as the audit execution backend

## System Components

1. OutSystems Frontend (Future)

The frontend application will be implemented in OutSystems.

Responsibilities:
- manage projects
- manage applications
- manage screens
- create reports
- trigger report runs
- view findings
- filter and explore audit results
- present future dashboards and history views

The frontend will consume the backend through REST APIs.

2. Node Backend API

The backend API will be implemented in Node.js.

Responsibilities:
- expose REST endpoints
- validate requests
- receive report run requests
- orchestrate audit execution
- return run status
- return findings
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

1. Data Storage Strategy

During the first validation phase, the backend may return findings directly through the API.

In the intended architecture, most relational data can remain in OutSystems.

This includes:
- Projects
- Applications
- Screens
- Reports
- ReportRuns
- Guidelines
- Findings
- summarized metrics for reporting

This keeps OutSystems as the main product data layer, while Node remains focused on execution.

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

Core resources:
- Projects
- Applications
- Screens
- Reports
- ReportRuns
- Guidelines
- Findings

Example endpoint groups:

```text
POST /projects
GET /projects

POST /applications
GET /applications

POST /screens
GET /screens

POST /reports
GET /reports

POST /reports/{id}/run
GET /runs/{id}
GET /runs/{id}/findings
```
The API contract will be defined using OpenAPI and explored through Swagger UI.

## Development-Time Architecture

For the validation phase, the system can start with a simple shape:
```text
Swagger UI / Postman
        │
        ▼
Dockerized Node Backend
        │
        ├── API layer
        └── Audit runner
```
This allows backend validation before the OutSystems frontend exists.

## Future Production-Oriented Architecture

```text
OutSystems Frontend
        │
        ▼
Node API
        │
        ▼
Job Queue
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

## Testing Strategy

The validation process includes multiple layers.

1. Swagger UI

Used as a temporary interactive frontend for manual API exploration.

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

Frontend (future) -> OutSystems

Backend API -> Node.js

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

The main goal of this platform is to provide a reliable and scalable way to detect accessibility issues early in the development process.
