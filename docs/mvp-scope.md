# Accessibility Audit Platform — MVP Scope

## Purpose

This document defines the scope of the **Minimum Viable Product (MVP)** for the Accessibility Audit Platform backend.

The MVP exists to validate:

- the backend architecture
- the Playwright + axe-core audit engine
- the API design
- the execution flow of accessibility scans
- the normalized results contract exposed by the API

The MVP will be validated as an **API-first, client-agnostic backend**.

---

# MVP Objective

The MVP backend must allow a developer to:

1. Configure an application to audit, including its screens
2. Create a report configuration
3. Trigger an accessibility scan
4. Execute axe-core using Playwright
5. Retrieve normalized accessibility findings through the API

The MVP proves that the **audit engine, normalization pipeline, and system architecture work end-to-end through the API**.

The main purpose of this MVP is to return normalized accessibility results through a stable backend contract, regardless of which client consumes it.

The backend is also responsible for persisting the audit-domain resources required by that contract.

---

# In Scope (MVP Features)

The MVP backend must support the following capabilities.

## Project Management

The system allows creating logical project containers.

Supported actions:

- create project
- list projects

Purpose:
Organize applications under a project.

These project records must be stored by the backend platform.

---

## Application Configuration

An application represents a web system being audited.

Supported actions:

- create application
- optionally create the initial application screens in the same request
- associate application to a project
- configure accessibility target level
- configure device type
- configure viewport size
- configure wait time before scanning
- update the application's screen collection within the application context

Application configuration must be stored by the backend platform.

MVP configuration includes:

- device type (desktop / tablet / phone)
- viewport width and height
- wait time in milliseconds
- accessibility target level

---

## Application Screens

A screen represents a URL that can be audited.

Supported actions:

- define screens as part of application creation or update
- store screen names and URLs under an application
- use those application-owned screens as report targets

Defined screens must be stored by the backend platform.

---

## Report Configuration

A report defines a set of screens that will be audited together.

Supported actions:

- create report
- associate report to an application
- select screens to include in the report
- optionally configure authentication settings

Report definitions must be stored by the backend platform.

MVP report configuration may include:

- authentication enabled flag
- login URL
- username
- password

---

## Report Execution

The system must allow triggering a report run.

Supported actions:

- trigger report run
- execute scans sequentially
- track run lifecycle

Lifecycle states:

- pending
- running
- completed
- failed

---

## Accessibility Scan Execution

The backend must perform automated accessibility scans using:

- Playwright (browser automation)
- axe-core (accessibility engine)

Each screen in the report must be scanned.

---

## Findings Processing

The system must:

- collect axe-core violations
- normalize findings
- associate findings with the screen and report run
- associate findings with a guideline reference

The MVP contract should expose normalized findings instead of raw axe-core payloads.

This normalized response model is the primary deliverable of the MVP.

---

## Findings Retrieval

The backend must expose endpoints to retrieve:

- report run status
- findings for a report run

Findings should include normalized references such as:

- screen
- guideline
- rule code
- message
- selector path

---

## Guidelines Reference

The MVP backend must support a guideline reference model used by findings.

Supported actions:

- expose guideline data for classification/reference
- associate findings to guidelines

Guidelines may be seeded from a static dataset rather than manually managed.

---

## API Documentation

The backend API must include:

- OpenAPI specification
- Swagger UI

This allows manual exploration of the API before any dedicated client exists.

The API examples should demonstrate application creation with embedded screens so the intended MVP workflow is clear.

The OpenAPI examples should present one coherent MVP workflow across the resource hierarchy so that Swagger preview reflects a believable end-to-end audit flow.

Validation and execution error examples should also be operation-specific, so each endpoint demonstrates realistic invalid requests and failure conditions for that resource.

---

## Backend Validation Tools

The MVP must include tools for validating the backend:

### Swagger UI
Interactive API exploration.

### Postman Collection
Manual validation of full workflows.

### Playwright API Tests
Automated validation of API endpoints.

---

## Persistence

The MVP must include a backend-owned database for the audit domain.

This database stores the resource model required by the API, including projects, applications, application-owned screens, reports, report runs, guidelines, and findings.

PostgreSQL is the recommended database for the MVP.

---

# Out of Scope (Not Included in MVP)

The following features are **explicitly excluded** from the MVP.

They may be implemented in future phases.

## Advanced Reporting

Not included:

- dashboards
- charts
- trend analysis
- historical comparisons

Historical report runs may exist in the MVP, but advanced reporting over that history is out of scope.

---

## Issue Management

Not included:

- assigning issues
- marking issues as resolved
- issue lifecycle management

Although the domain model may contain a finding status field, full issue-management workflows are out of scope.

---

## Export Features

Not included:

- PDF export
- CSV export
- Excel export

---

## Automated Crawling

Not included:

- automatic discovery of pages
- site-wide crawling

Screens must be manually defined under an application.

---

## Scheduling

Not included:

- scheduled scans
- cron-based audits

All report runs must be triggered manually.

---

## Parallel Scan Execution

Not included:

- worker pools
- queue-based job execution

Scans may run sequentially in the MVP.

The architecture will allow scaling later.

---

## Full Client Interface

No full client application is **required for the MVP**.

Backend validation will be performed using:

- Swagger UI
- Postman
- automated tests

---

# Definition of Done (MVP Backend)

The MVP backend is considered complete when the following workflow works end-to-end.

1.	Create project
2.	Create application with one or more screens
3.	Create report
4.	Trigger report run
5.	Playwright loads each selected screen
6.	axe-core performs scan
7.	Findings are collected and normalized
8.	Findings are linked to screens, report run, and guideline references
9.	API returns normalized results

Additionally:

- API documentation is available via Swagger
- Postman collection validates the full flow
- Automated API tests run successfully

---

# MVP Validation Goal

The MVP proves that the system can reliably perform accessibility audits using Playwright and axe-core through a structured backend API.

Once validated, development can proceed to:

- one or more client applications or integrations
- background workers
- advanced reporting features
- scalability improvements
