# Domain Model

## Purpose

This document defines the core backend domain model for the Accessibility Audit Platform MVP.

The goal is to establish a stable product model before API design and implementation begin.

This model is based on:
- the agreed MVP backend scope
- the current architecture direction
- the current frontend mockup flows

The backend must remain understandable and usable even without the frontend being implemented.

## Domain Overview

The MVP domain is centered around organizing audit work in the following hierarchy:

Project → Application → Screen → Report → ReportRun → Finding

In addition, findings reference accessibility guidelines:

Guideline → Finding

## Core Principles

- A **Project** represents a customer initiative.
- A **Project** contains one or more **Applications**.
- An **Application** contains one or more **Screens** to be audited.
- A **Report** defines an audit configuration for a selected set of screens.
- A **ReportRun** represents one execution instance of a report.
- A **Finding** represents one normalized accessibility issue detected during a report run.
- A **Guideline** represents the accessibility rule or success criterion referenced by findings.
- The backend should expose normalized data structures instead of raw scanner payloads.

## Entities

## 1. Project

### Description
A top-level container representing a customer project.

### Required MVP Fields
- `id`
- `name`
- `customerName`
- `createdAt`
- `updatedAt`

### Relationships
- One Project has many Applications

### Notes
The mockups show project creation and editing with at least:
- project name
- customer name

## 2. Application

### Description
A target application inside a project that can be configured for accessibility audits.

### Required MVP Fields
- `id`
- `projectId`
- `name`
- `device`
- `width`
- `height`
- `waitTimeMs`
- `accessibilityTarget`
- `createdAt`
- `updatedAt`

### Relationships
- One Application belongs to one Project
- One Application has many Screens
- One Application has many Reports

### Notes
Based on the mockups, an application includes runtime and audit configuration such as:
- targeted accessibility standard/version/levels
- device type
- viewport width
- viewport height
- wait time

Possible MVP values:
- `device`: desktop, tablet, phone
- `accessibilityTarget.standard`: WCAG
- `accessibilityTarget.version`: 2.0, 2.1, 2.2
- `accessibilityTarget.levels`: A, AA, AAA

These exact enums can be finalized during API contract design.

## 3. Screen

### Description
A single auditable page or route inside an application.

### Required MVP Fields
- `id`
- `applicationId`
- `name`
- `url`
- `createdAt`
- `updatedAt`

### Relationships
- One Screen belongs to one Application
- One Screen can be included in many Reports
- One Screen can appear in many Findings through ReportRuns

### Notes
The mockups show screens being managed from the application settings screen.

A screen is defined minimally by:
- a human-readable name
- a target URL

## 4. Report

### Description
A reusable audit definition for an application.

A report does not represent execution itself. It represents the configuration that can later be executed one or more times.

### Required MVP Fields
- `id`
- `applicationId`
- `name`
- `authenticationEnabled`
- `loginUrl` (optional)
- `username` (optional)
- `password` (optional, sensitive)
- `createdAt`
- `updatedAt`

### Relationships
- One Report belongs to one Application
- One Report selects one or more Screens
- One Report has many ReportRuns

### Notes
The mockups show report creation with:
- report name
- selected screens
- optional authentication toggle
- optional login URL / username / password

Authentication support may be only partially implemented in the MVP, but the model should allow it.

### Important Distinction
A Report is a configuration object.  
A ReportRun is an execution object.

## 5. ReportScreen

### Description
A join relationship representing which screens are included in a report.

### Required MVP Fields
- `reportId`
- `screenId`

### Relationships
- Many Reports can include many Screens
- This is a many-to-many relationship

### Notes
Even if not exposed as a first-class API resource, this relationship should exist in the domain model.

## 6. ReportRun

### Description
A single execution instance of a report.

### Required MVP Fields
- `id`
- `reportId`
- `status`
- `startedAt` (optional until run starts)
- `finishedAt` (optional until run ends)
- `errorMessage` (optional)
- `summary` (optional)
- `summary.totalFindings` (optional)
- `summary.screensScanned` (optional)
- `summary.screensPlanned` (optional)
- `summary.findingsByImpact` (optional)
- `createdAt`
- `updatedAt`

### Relationships
- One ReportRun belongs to one Report
- One ReportRun has many Findings

### Notes
The lifecycle must be defined separately in Story 0.3.

Minimum expected statuses:
- `pending`
- `running`
- `completed`
- `failed`

The mockups also imply that multiple runs can exist over time for the same report, since the UI shows:
- last report date
- historical charts
- run-based summaries

## 7. Guideline

### Description
A structured accessibility rule or success criterion used to classify findings.

### Required MVP Fields
- `id`
- `code`
- `name`
- `level`
- `standard`
- `createdAt`
- `updatedAt`

### Relationships
- One Guideline can be referenced by many Findings

### Notes
The mockups show a guidelines area with at least:
- rule ID / code (for example `1.1.1`)
- name
- level (A, AA, AAA)
- different guideline groupings or versions within WCAG

Possible examples:
- `code`: `1.1.1`
- `name`: `Text Alternatives`
- `level`: `A`
- `standard`: `WCAG`

This entity may be seeded from a static dataset rather than created manually by users.

## 8. Finding

### Description
A normalized accessibility issue produced by a report run.

### Required MVP Fields
- `id`
- `reportRunId`
- `screenId`
- `guidelineId`
- `ruleCode`
- `message`
- `impact` (optional if available)
- `severity` (optional if modeled separately)
- `htmlSnippet` (optional)
- `selector`
- `createdAt`

### Relationships
- One Finding belongs to one ReportRun
- One Finding belongs to one Screen
- One Finding references one Guideline

### Notes
The mockups indicate that findings may include:
- guideline reference
- message / explanation
- element snippet
- selector or DOM path
- screen association

For the current MVP public contract, findings are read-only scan results.

This means the normalized API shape does not currently expose:
- a finding lifecycle status
- an `updatedAt` field

### Important Modeling Rule
The default backend response shape must be normalized.

The raw scanner payload from axe-core should not be exposed as the main contract shape.

Raw payloads may be stored internally for debugging in the future, but they are out of scope for the normalized MVP contract.

## Relationships Summary

- Project `1 -> many` Applications
- Application `1 -> many` Screens
- Application `1 -> many` Reports
- Report `many -> many` Screens
- Report `1 -> many` ReportRuns
- ReportRun `1 -> many` Findings
- Screen `1 -> many` Findings
- Guideline `1 -> many` Findings

## Suggested Entity Diagram (Text Form)

```text
Project
  └── Applications

Application
  ├── Screens
  └── Reports

Report
  ├── selected Screens
  └── ReportRuns

ReportRun
  └── Findings

Finding
  ├── Screen reference
  └── Guideline reference
