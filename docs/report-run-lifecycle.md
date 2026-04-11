# Report Run Lifecycle

## Purpose

This document defines the lifecycle of a `ReportRun` in the Accessibility Audit Platform MVP.

The goal is to make execution state changes explicit before implementation begins, so that:
- backend behavior is predictable
- API responses are consistent
- future automation and testing can rely on a stable execution model

This lifecycle applies to the execution of a `Report`, not to report configuration itself.

The lifecycle is part of the API contract and must remain stable regardless of which client consumes run status and normalized results.

## Scope

This document covers:
- the valid states of a `ReportRun`
- allowed transitions between states
- the meaning of each state
- high-level triggers for state changes
- high-level failure conditions

This document does not define:
- API endpoint contracts
- retry strategy
- queueing implementation
- client display behavior

## Core Principle

A `Report` is a reusable audit configuration.

A `ReportRun` is one execution instance of a `Report`.

Each time a report is triggered, a new `ReportRun` is created and follows the lifecycle defined below.

## States

The MVP includes the following `ReportRun` states:

- `pending`
- `running`
- `completed`
- `failed`

## State Definitions

### `pending`

The run has been created, but execution has not started yet.

Typical meaning:
- the run record exists
- the system accepted the execution request
- browser automation and scanning have not started yet

### `running`

The run is actively being executed.

Typical meaning:
- one or more screens are being processed
- Playwright is opening pages
- axe-core analysis is being executed
- findings may already be collected internally, but the run is not yet finalized

### `completed`

The run finished successfully.

Typical meaning:
- all intended screens were processed
- findings were normalized
- results were stored successfully
- summary metrics were finalized

This is a terminal state.

### `failed`

The run could not complete successfully.

Typical meaning:
- execution started or was about to start
- a fatal error prevented successful completion
- the run ended without a valid completed result set

This is a terminal state.

## Allowed Transitions

Only the following transitions are valid in the MVP:

- `pending → running`
- `running → completed`
- `running → failed`

No other transitions are valid.

## Invalid Transitions

The following are explicitly invalid in the MVP:

- `pending → completed`
- `pending → failed`
- `completed → running`
- `completed → failed`
- `failed → running`
- `failed → completed`

Once a run reaches `completed` or `failed`, it must not transition to another state.

If a user wants to execute the same report again, the system must create a new `ReportRun`.

## Transition Triggers

### `pending → running`

This transition happens when the backend starts processing the run.

Typical trigger:
- the execution service begins audit work for the selected report

Expected effects:
- `status` becomes `running`
- execution start timestamp may be recorded

### `running → completed`

This transition happens when the audit finishes successfully.

Typical trigger:
- all selected screens were processed
- findings were normalized and stored
- summary data was finalized without fatal errors

Expected effects:
- `status` becomes `completed`
- completion timestamp may be recorded
- summary metrics are available

### `running → failed`

This transition happens when execution cannot finish successfully.

Typical trigger:
- a fatal runtime error interrupts the audit flow
- required processing cannot continue safely
- findings cannot be finalized correctly

Expected effects:
- `status` becomes `failed`
- completion timestamp may be recorded
- high-level error information may be stored

## High-Level Lifecycle Diagram

```text
pending
   ↓
running
  ↙   ↘
failed  completed
