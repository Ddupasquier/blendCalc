# Rehearsal benchmark baseline

These measurements are regression signals, not performance guarantees. Compare future
runs on equivalent hardware and investigate material regressions before release.

Measured 2026-09-12 on macOS arm64, Apple M1, Node.js 24.18.0, Supabase CLI 2.117.0,
Docker 29.5.2, and local warm container images.

## BlendCalc production-shaped baseline

Current corpus: 18,847 sanitized rows, 126 tables, 251 represented migrations, zero
candidates. The timing sample below was captured from the preceding 18,764-row artifact;
refresh it before beta after the production-shaped authentication and readability
contract is frozen.

| Phase                                      | Time     |
| ------------------------------------------ | -------- |
| Baseline checksum verification             | 682 ms   |
| Migration inventory and candidate planning | 1,012 ms |
| Database reset, restore, and verification  | 83.70 s  |
| Public CLI run plus BlendCalc app proof    | 105.56 s |

The complete run includes local Supabase stop/start overhead, replaying the historical
schema, streaming the baseline, the project-specific synthetic developer overlay, exact
row/FK verification, candidate reconciliation, and final migration-ledger verification.

## Independent fixture

Corpus: one synthetic row, one table, one represented migration, one valid candidate,
and one deliberately invalid candidate.

| Phase                                         | Time    |
| --------------------------------------------- | ------- |
| Baseline activation and plan                  | 23 ms   |
| Installed-package valid CLI run and app proof | 38.50 s |
| Installed-package invalid refusal and cleanup | 33.89 s |

Most fixture time is local Supabase container lifecycle overhead. The fixture installs
the exact prospective npm tarball before both executions. The failure timing includes
rebuilding the baseline runtime, applying the valid prefix candidate, refusing the
invalid SQL candidate, and removing the untrusted runtime.

## Linux portability proof

Measured 2026-09-12 using Node.js 24.21.0 in Ubuntu Bookworm arm64 against the local
Colima Docker host, Supabase CLI 2.117.0, and the exact installed prospective tarball.
The valid migration and application proof passed in 40.49 seconds. The invalid migration
was refused and its exact project-labelled runtime was removed in 39.39 seconds. This
run exposed and fixed the fresh-runtime cleanup path and proves Linux arm64 behavior;
the same proof remains required in GitHub Actions before public release.

## Regression policy

Record a new equivalent sample before a beta release or after changing baseline format,
streaming, restore, migration application, verification, or local-runtime lifecycle.
Investigate a repeatable increase greater than 25% in a phase. Do not weaken checks to
recover time; optimize only after identifying the measured bottleneck.
