# Database Testing

blendCalc uses a resettable local Supabase stack for migration, RLS, Auth, Storage,
and database-integration testing. The local stack is isolated from the linked production
project and contains only disposable QA data.

## First Run

```bash
npm run db:test:start
```

This command starts the Docker-compatible runtime when Colima is installed, starts the
local Supabase services, writes local credentials to the gitignored
`.env.test.local`, and creates regular-user, moderator, and admin QA accounts.

Run the app against the local database with:

```bash
npm run dev:test
```

The local account password and emails are printed by the database command and stored in
`.env.test.local` for local tooling.

## Commands

| Command | Purpose |
|---|---|
| `npm run db:test:start` | Start the local stack and ensure QA accounts exist. |
| `npm run db:test:reset` | Destroy local data, replay every migration, and reseed QA accounts. |
| `npm run db:test:verify` | Reset the local database and run all pgTAP database tests. |
| `npm run db:test:status` | Print local service URLs and status. |
| `npm run db:test:stop` | Stop the local Supabase stack while retaining its Docker volume. |
| `npm run dev:test` | Start SvelteKit in test mode against `.env.test.local`. |

## Safety Boundary

- Test commands always pass `--local` for destructive database resets and pgTAP tests.
- The generated environment writer rejects any Supabase URL that is not localhost.
- Never add `--linked` to a test command. The linked project contains live application
  data and is not a disposable test target.
- Never copy production users or private records into local seeds. Create synthetic QA
  fixtures instead.
- `supabase/seed.sql` remains safe to replay. Local login-capable users are created only
  after the local Auth API is available.

## What This Enables

- Complete migration-chain verification from an empty database.
- Low-level pgTAP checks for schema, functions, constraints, and RLS configuration.
- Supabase-client integration tests against real Auth, PostgREST, Storage, and database
  policies rather than mocks.
- Repeatable destructive QA without risking production records.

A separate remote staging project can be added later for real-device and hosted-preview
QA. It should use the same migrations and synthetic fixtures, never a production data
copy.
