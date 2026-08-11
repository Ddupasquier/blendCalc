# Hosted Security And Recovery

This document owns the production Supabase security baseline, repeatable hosted audit,
backup policy, recovery drill, and emergency procedures. Authentication behavior lives
in [`authentication.md`](authentication.md); database policies and tables live in
[`supabase-schema.md`](supabase-schema.md).

## MVP Targets

| Target | Approved baseline |
| --- | --- |
| Maximum database data loss | 24 hours |
| Recovery target | Restore essential service within 4 hours |
| Direct Postgres access | Trusted operator networks only |
| Hosted CI database access | None |
| Managed backups | Completed daily physical backup |
| Additional recovery copy | Protected logical public-schema/data backup plus Storage files |
| Privileged authentication | TOTP enrolled and AAL2 required for moderator, administrator, and developer actions |
| Bot protection | CAPTCHA token supplied by the browser before hosted CAPTCHA is enabled |
| Auth event review | Failed sign-ins, recovery, MFA, role, block, and token-revocation events reviewed through hosted logs |

Point-in-time recovery is not an MVP requirement while daily recovery stays verified.
Reconsider it when losing up to one day of data or a four-hour recovery becomes
unacceptable.

## Current Hosted Baseline

The linked production project was verified on **August 11, 2026**:

- Direct Postgres and pooler connections accept one trusted operator network rather
  than all internet addresses. This does not block the app's normal HTTPS calls to
  Auth, Storage, or the data API.
- GitHub Actions has no production database credentials or direct migration workflow.
- Eight completed daily physical backups were visible, the newest less than one day
  old. Point-in-time recovery was disabled.
- A protected logical backup restored **88 public tables and 1,098,271 rows** into the
  disposable local stack with exact row-count agreement and valid foreign keys.
- All **5 Storage objects** were downloaded, checksum-verified, restored locally, and
  checksum-verified again. Database backups alone do not contain those file bytes.
- Email confirmation, 15-character passwords, breached-password screening, secure
  password changes, refresh-token rotation/reuse detection, hosted rate limits, and
  TOTP capability are enabled.
- Production, local development, isolated browser testing, and restricted Vercel
  preview Auth callbacks are allowed.

The following launch gates remain intentionally blocked rather than partially enabled:

- Cloudflare Turnstile needs a site key, secret key, browser token flow, and approved
  Auth-screen presentation before hosted CAPTCHA can be enabled.
- Custom SMTP needs verified provider credentials before confirmation and recovery
  email delivery can be treated as production-ready.
- Elevated accounts need enrollment, challenge, and recovery screens before moderator,
  administrator, and developer actions can require AAL2 without locking out operators.
- Hosted Auth log retention must be confirmed against the active Supabase plan.

## Read-Only Hosted Audit

Run the audit after changing Supabase settings and before promotion or release:

```bash
node scripts/audits/security/audit_hosted_security.mjs
node scripts/audits/security/audit_hosted_security.mjs --strict
```

The default report is diagnostic. `--strict` exits unsuccessfully while required
controls fail or remain blocked. Add `--json` for a secret-safe machine-readable
snapshot. The report includes only network entry counts; it never prints trusted
addresses, CAPTCHA secrets, SMTP passwords, service-role keys, database passwords, or
Supabase access tokens.

The script reads `SUPABASE_ACCESS_TOKEN` when provided. On macOS it can otherwise use
the existing Supabase CLI Keychain credential. Never place an access token in a tracked
file.

## Protected Backups

Create an additional logical database and Storage backup outside the repository:

```bash
node scripts/operations/recovery/create_protected_hosted_backup.mjs
```

The default private location is:

```text
~/Library/Application Support/blendCalc/backups/<UTC timestamp>/
```

The operation writes the public schema, public data, every Storage object, a Storage
manifest, and SHA-256 checksums. Directories are owner-only and files deny group/public
access. It reads production but never changes it. The database password comes from
`SUPABASE_DB_PASSWORD` or the maintained macOS Keychain item; Storage access comes from
the gitignored moderation environment.

Verify a backup without contacting Supabase:

```bash
node scripts/operations/recovery/verify_protected_hosted_backup.mjs \
  "/absolute/path/to/the/backup"
```

Do not copy these backups into the repository, ordinary cloud-sync folders, issue
attachments, chat, or CI artifacts. They contain user data.

## Recovery Drill

Perform this against disposable local Supabase only:

1. Create and checksum-verify a fresh protected backup.
2. Run `npm run db:test:reset` so migrations recreate the current schema locally.
3. Truncate local public tables and import `public-data.sql` with foreign-key triggers
   deferred for the import session.
4. Compare every imported public-table count with the matching `COPY` block in the
   backup; require exact agreement and validated foreign keys.
5. Recreate missing local Storage buckets from the manifest, upload every backed-up
   object, and require exact byte size and SHA-256 agreement.
6. Exercise sign-in plus one representative Ingredients, Mix, Saved, Profile, and
   moderation read against the restored local data.
7. Run `npm run db:test:reset` again so production-derived data is removed and the
   deterministic QA baseline returns.

Never use a linked-project reset, import, or restore command for this drill. A managed
production restore is initiated through Supabase support/dashboard tooling only after
confirming the requested recovery point and expected downtime.

## Routine Schedule

| Frequency | Action |
| --- | --- |
| Before every release | Run the hosted audit and verify the newest managed backup is recent |
| Monthly | Create and checksum-verify a protected database/Storage backup |
| Quarterly | Perform the complete disposable local recovery drill |
| After role or Auth changes | Review elevated assignments, callback URLs, MFA capability, and Auth audit events |
| After an incident | Preserve relevant hosted logs, rotate affected credentials, run the audit, and record the recovery result |

Delete superseded protected backups according to the approved retention period only
after a newer backup has passed checksum verification. Do not leave incomplete backup
directories in the protected backup root.

## Emergency Procedures

### Trusted Network Changed

If the operator's public address changes, normal app traffic continues but linked CLI
database commands can fail. From a trusted machine with Supabase CLI access, replace
the allowlist rather than reopening Postgres globally:

```bash
export SUPABASE_PROJECT_ID="your-project-ref"
export TRUSTED_DATABASE_CIDR="your-current-public-ip/32"
supabase network-restrictions update \
  --project-ref "$SUPABASE_PROJECT_ID" \
  --db-allow-cidr "$TRUSTED_DATABASE_CIDR" \
  --experimental
node scripts/audits/security/audit_hosted_security.mjs
```

Do not commit either value. Add another CIDR only when a second trusted operator or
static deployment runner genuinely requires direct database access.

### Privileged Account Compromised

1. Remove the elevated role immediately:

   ```bash
   npm run moderate -- role user@example.com none --user-id=<verified-user-id>
   ```

2. Ban the account if the identity itself may be compromised:

   ```bash
   npm run moderate -- ban user@example.com compromised_privileged_account
   ```

3. Revoke active sessions in Supabase Auth, remove untrusted MFA factors, rotate any
   exposed credentials, and inspect Auth plus moderation audit events.
4. Restore access only after identity verification and fresh MFA enrollment.

### Suspicious Authentication Activity

Review Supabase Auth logs for failed logins, recovery attempts, MFA factor changes,
token refresh/revocation, and account deletion. Correlate by user identifier and time;
do not copy raw IP addresses, tokens, email addresses, or user agents into tracked
documents. Tighten rate limits or enable the already-integrated CAPTCHA path only after
verifying legitimate users can still authenticate.

### Data Loss Or Corruption

1. Stop the affected write path without deleting evidence.
2. Record the first known bad time and the last known good time.
3. Verify the newest managed and protected backups before choosing a recovery point.
4. Restore into disposable local Supabase first and validate representative app reads.
5. Request the production restore only after the local evidence is sound.
6. Restore Storage files separately when file bytes were deleted or corrupted.
7. Rotate affected secrets, run database lint/tests and the hosted audit, then reopen
   writes gradually.

## External References

- [Supabase network restrictions](https://supabase.com/docs/guides/platform/network-restrictions)
- [Supabase backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase password security](https://supabase.com/docs/guides/auth/password-security)
- [Supabase CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha)
- [Supabase MFA](https://supabase.com/docs/guides/auth/auth-mfa)
- [Supabase Auth audit logs](https://supabase.com/docs/guides/auth/audit-logs)
- [GitHub-hosted runner networking](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
