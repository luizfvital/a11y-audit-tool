# Audit Execution Flow

## Purpose

This document defines the MVP audit execution flow for the Accessibility Audit Platform.

The goal is to describe how the system moves from:

- report configuration
- report execution
- raw scan processing
- normalized finding generation

This document exists to make backend behavior explicit before implementation begins.

## Scope

This document covers:

- how a `Report` is prepared for execution
- how a `ReportRun` is created and progresses through execution
- how the audit engine interacts with selected screens
- how raw audit results are normalized into `Finding` records
- how final results become available for retrieval

This document does not define:

- client-side behavior
- API endpoint contracts
- queueing or worker-topology details
- advanced retry or scheduling behavior
- dashboard or reporting UI concerns

## Core Distinction

A `Report` is a reusable audit configuration.

It defines:

- the application being audited
- the selected screens to scan
- optional authentication settings

A `ReportRun` is one execution instance of a `Report`.

It represents:

- a single triggered audit run
- its runtime status
- its execution timestamps
- its resulting summary metrics

Each time the system executes a report, it must create a new `ReportRun`.

## Audit Engine Context

The MVP audit engine combines:

- Playwright for browser automation and page interaction
- axe-core for accessibility analysis

Within the overall system:

- the backend orchestrates execution
- the audit runner processes the run
- Playwright opens and prepares each screen
- axe-core generates raw accessibility results
- the backend normalizes those results into the domain `Finding` model

## Preconditions

Before a report can be executed in the MVP, the following must already exist:

- a `Project`
- an `Application` inside that project
- one or more `Screens` inside the application
- a `Report` associated with the application
- one or more selected screens linked to the report

In the MVP public API, those screens are created and maintained through the parent `Application`.

The application provides execution settings such as:

- device type
- viewport width
- viewport height
- wait time before scanning
- accessibility target level

The report may also include optional authentication data.

## High-Level Flow

```text
Project
  -> Application
    -> Screens
      -> Report
        -> ReportRun created
          -> ReportRun pending
            -> ReportRun running
              -> Playwright opens each selected screen
              -> wait configured time
              -> axe-core scans page
              -> raw results collected
              -> results normalized into Findings
              -> Findings stored
            -> ReportRun completed or failed
              -> results exposed for retrieval
```

## Execution Flow

### 1. Report Is Defined

The user creates a `Report` for an existing `Application`.

The report defines:

- a name
- the set of selected screens from that application's screen collection
- optional authentication configuration

At this stage, no audit has been executed yet.

The report is only a reusable configuration object.

### 2. Execution Is Triggered

When execution is requested, the system creates a new `ReportRun` for that report.

Initial expectations:

- the `ReportRun` references exactly one `Report`
- the initial status is `pending`
- execution has not started yet

This preserves the distinction between:

- `Report`: reusable definition
- `ReportRun`: concrete execution instance

### 3. Run Transitions to `running`

When the backend begins processing the run, the `ReportRun` transitions from `pending` to `running`.

At this point, the system is actively executing audit work.

Typical effects:

- execution start time may be recorded
- the system resolves the report configuration
- the system loads the selected screens for processing
- the system prepares browser automation settings from the application

This transition must follow the lifecycle defined in `report-run-lifecycle.md`.

### 4. The Audit Runner Processes Each Selected Screen

For each screen included in the report, the system performs the following MVP steps:

1. Open the target page with Playwright.
2. Apply the configured viewport and execution settings.
3. If authentication is enabled and supported, perform the required login/navigation steps.
4. Wait for the configured wait time to allow the page to stabilize.
5. Execute axe-core against the loaded page.

In the MVP, screens may be processed sequentially.

Parallel execution, worker pools, and distributed job processing are out of scope.

### 5. Raw Audit Results Are Collected

For each scanned screen, axe-core returns raw accessibility analysis results.

These raw results are considered execution data, not the public domain model.

The system may use them internally during processing, but the MVP contract should not expose raw scanner payloads as the primary result shape.

### 6. Raw Results Are Normalized Into Findings

The backend transforms raw audit results into normalized `Finding` records.

This normalization step is the core MVP value: it converts tool-specific scanner output into a stable API response model that any client can consume.

For each relevant issue identified by the scanner, the system extracts and maps data such as:

- rule code
- message or explanation
- selector path
- relevant HTML snippet or element context
- impact or severity data when available

The normalization step must also resolve domain relationships.

Each `Finding` must be associated with:

- the current `ReportRun`
- the originating `Screen`
- the related `Guideline`

Guideline mapping links scanner rule information to the system's structured guideline model.

This keeps findings consistent with the domain model and avoids leaking raw tool-specific payloads into the main backend contract.

### 7. Findings Are Stored

After normalization, the system stores the generated findings for the current run.

In the MVP, these findings are stored by the backend platform in its own database together with the related run, screen, and guideline references.

In MVP terms, successful processing means:

- findings exist as normalized records
- findings are linked to the run, screen, and guideline
- results are ready for later retrieval through the backend

### 8. Run Summary Is Finalized

After all selected screens are processed successfully, the system finalizes the `ReportRun`.

Typical summary data includes:

- total findings
- number of screens scanned
- finish timestamp

If all required processing completes successfully, the run transitions to `completed`.

### 9. Failure Handling

If a fatal error prevents the run from completing successfully, the run transitions to `failed`.

Examples of high-level failure conditions may include:

- browser automation cannot continue
- required page processing fails fatally
- result normalization cannot complete safely
- findings cannot be stored correctly

When this happens:

- the run must not transition to `completed`
- high-level error information may be recorded
- the run ends as a terminal failed execution

This document does not define retries or partial-success strategies for the MVP.

### 10. Results Are Exposed for Retrieval

Once the run reaches a terminal state, the backend can expose:

- run status
- run summary information
- normalized findings for the run

This retrieval behavior is backend-oriented and independent of client implementation details.

## Normalization Rules

The MVP normalization approach should follow these principles:

- findings are normalized backend records, not raw axe-core objects
- findings reference domain entities instead of only embedded strings
- guideline mapping is explicit
- screen association is explicit
- run association is explicit

The goal is a stable backend data model that remains usable even before any dedicated client exists.

## Alignment With MVP Scope

This flow intentionally stays within the MVP.

Included:

- manual report triggering
- sequential screen processing
- Playwright + axe-core execution
- normalized findings
- run status tracking
- result retrieval through the backend

Explicitly excluded here:

- scheduled execution
- automated crawling
- advanced reporting
- issue-management workflows
- queue-based scaling strategies
- client-specific interaction design

## Related Documents

- `docs/architecture.md`
- `docs/domain-model.md`
- `docs/mvp-scope.md`
- `docs/report-run-lifecycle.md`
