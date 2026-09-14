# Rehearsal fixture project

This synthetic project proves that the Rehearsal developer contract does not require
BlendCalc tables, credentials, policy, or undocumented setup. It contains one `widgets`
table, one private Storage bucket and exact byte, a one-row sanitized baseline, one valid
candidate migration, and two deliberately broken candidates.

The fixture is data-safe and deterministic. Its files are copied into a disposable
directory by tests; they are never linked to a hosted Supabase project.

From the BlendCalc repository, an unfamiliar developer can run the complete documented
proof with Node.js 24 and Docker:

```bash
npm run rehearsal:fixture:prove
```

The script creates and verifies the fixture baseline, executes the valid candidate
through the public CLI, verifies the exact Storage byte was restored, runs the
fixture-owned application proof, deliberately adds the invalid candidate, verifies the
stable refusal, and deletes its disposable runtime.
No manual knowledge of BlendCalc's schema or policy is required.

Expected classifications:

- `20260101000000_create_widgets.sql` is represented by the baseline.
- `20260101000100_add_widget_description.sql` is a valid candidate.
- `broken/20260101000100_modified_history.sql` simulates changed historical bytes and
  must be rejected before runtime work.
- `broken/20260101000200_invalid_candidate.sql` is validly named but contains invalid
  PostgreSQL and must fail migration application without leaving a trusted runtime.
