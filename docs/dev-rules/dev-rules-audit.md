# Development Rules Audit

Last audited: 2026-08-10

## Purpose

This document defines how a development-rules audit is performed. It is not an active
task list. Every verified unresolved finding is recorded once in the centralized,
priority-ordered [`work-queue.md`](../work-queue.md).

The [development rules](dev-rules.md) remain authoritative. An audit finding never
overrides a settled rule.

## Audit Procedure

1. Read the development rules and current work queue.
2. Verify suspected findings against the current implementation, tests, schema,
   generated contracts, documentation, and indirect consumers.
3. Search the work queue and completed QA archive before creating another item.
4. If the finding is already represented, update its existing evidence and completion
   condition instead of duplicating it.
5. If the finding is new, add one stable `DEV-###` item to the appropriate work-queue
   priority with evidence, affected ownership, a next action, and an exact completion
   condition.
6. Remove the queue item once implementation and required verification are complete.
   Preserve durable behavior in its owning documentation and observable proof in the QA
   archive where applicable.

## Current Findings

See [`work-queue.md`](../work-queue.md). It is the sole owner of active audit findings,
priority, order, and status.
