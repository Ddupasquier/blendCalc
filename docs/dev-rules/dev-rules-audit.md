# Development Rules Audit

Last audited: 2026-08-10

## Purpose

This document defines how a development-rules audit is performed. It is not an active
task list, findings list, or completion archive.

The [development rules](dev-rules.md) remain authoritative. An audit finding never
overrides a settled rule.

## Audit Procedure

1. Read the development rules and the designated active project tracker.
2. Verify suspected findings against the current implementation, tests, schema,
   generated contracts, documentation, and indirect consumers.
3. Search the active and completed project records before creating another item.
4. If the finding is already represented, update its existing evidence and completion
   condition instead of duplicating it.
5. If the finding is new, add one stable `DEV-###` item to the appropriate project
   priority with evidence, affected ownership, a next action, and an exact completion
   condition.
6. Remove the queue item once implementation and required verification are complete.
   Preserve durable behavior in its owning documentation and observable proof in the QA
   archive where applicable.

## Audit Output

Tracked documentation keeps only the repeatable procedure and durable system contract.
Active findings, priority, order, and status belong to the designated project tracker.
