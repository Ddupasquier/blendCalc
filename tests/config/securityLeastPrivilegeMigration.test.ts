import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	resolve(
		"supabase/migrations/20260729180000_security_least_privilege_and_rate_limits.sql",
	),
	"utf8",
);
const retentionMigration = readFileSync(
	resolve(
		"supabase/migrations/20260729183000_request_rate_limit_retention.sql",
	),
	"utf8",
);
const layeredRateLimitMigration = readFileSync(
	resolve("supabase/migrations/20260828160000_layered_request_rate_limits.sql"),
	"utf8",
);

describe("security least-privilege migration", () => {
	it("removes dangerous current and default Data API privileges", () => {
		expect(migration).toContain(
			"revoke truncate, references, trigger, maintain",
		);
		expect(migration).toContain(
			"revoke all on tables from anon, authenticated",
		);
		expect(migration).toContain(
			"revoke execute on functions from public, anon, authenticated",
		);
	});

	it("closes maintenance RPCs that were exposed to application roles", () => {
		expect(migration).toContain(
			"on function public.sync_nutrient_manual_entry_fields()",
		);
		expect(migration).toContain(
			"on function public.sync_user_compatibility_rules(uuid, text[], text[])",
		);
	});

	it("makes profile and image persistence server-owned", () => {
		expect(migration).toContain(
			"on table public.profiles\n\tfrom authenticated",
		);
		expect(migration).toContain(
			"on table public.profile_image_policy_acceptances",
		);
		expect(migration).toContain(
			'drop policy if exists "Users can upload their avatar files"',
		);
		expect(migration).toContain(
			'drop policy if exists "Users can upload their product evidence"',
		);
	});

	it("creates a private service-role request limiter", () => {
		expect(migration).toContain("create table public.request_rate_limits");
		expect(migration).toContain(
			"create or replace function public.consume_request_rate_limit(",
		);
		expect(migration).toContain("to service_role;");
		expect(migration).toContain("security definer");
		expect(migration).toContain("set search_path = ''");
	});

	it("bounds private request-counter retention without exposing cleanup", () => {
		expect(retentionMigration).toContain(
			"create or replace function public.consume_request_rate_limit(",
		);
		expect(retentionMigration).toContain(
			"where expires_at < v_now - interval '1 day'",
		);
		expect(retentionMigration).toContain("limit 1000");
		expect(retentionMigration).toContain("from public, anon, authenticated");
		expect(retentionMigration).toContain("to service_role");
	});

	it("consumes bounded layered quotas in one private database call", () => {
		expect(layeredRateLimitMigration).toContain(
			"create or replace function public.consume_request_rate_limits(p_limits jsonb)",
		);
		expect(layeredRateLimitMigration).toContain(
			"jsonb_array_length(p_limits) not between 1 and 12",
		);
		expect(layeredRateLimitMigration).toContain(
			"from public.consume_request_rate_limit(",
		);
		expect(layeredRateLimitMigration).toContain("to service_role");
	});
});
