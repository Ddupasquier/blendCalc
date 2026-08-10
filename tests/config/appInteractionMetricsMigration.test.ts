import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260730120000_app_interaction_daily_metrics.sql",
	"utf8",
);

describe("app interaction daily metrics migration", () => {
	it("stores bounded aggregate counts without user-level identifiers", () => {
		expect(migration).toContain(
			"create table public.app_interaction_daily_metrics",
		);
		expect(migration).toContain("event_count bigint not null");
		expect(migration).toContain("visitor_count bigint");
		expect(migration).not.toMatch(/\buser_id\b/);
		expect(migration).not.toMatch(/\bemail\b/);
		expect(migration).not.toMatch(/\bip_address\b/);
		expect(migration).not.toMatch(/\braw_payload\b/);
	});

	it("keeps reads private and replacements service-only", () => {
		expect(migration).toContain(
			"alter table public.app_interaction_daily_metrics enable row level security",
		);
		expect(migration).toContain(
			"create or replace function public.replace_app_interaction_daily_metrics",
		);
		expect(migration).toContain(
			"grant execute\n\ton function public.replace_app_interaction_daily_metrics(date, date, jsonb)\n\tto service_role",
		);
		expect(migration).not.toContain(
			"to anon, authenticated",
		);
	});

	it("replaces one bounded date range atomically", () => {
		expect(migration).toContain("(p_until - p_since) > 31");
		expect(migration).toContain("jsonb_array_length(p_metrics) > 500");
		expect(migration).toContain(
			"delete from public.app_interaction_daily_metrics",
		);
		expect(migration).toContain(
			"on conflict (\n\t\t\tmetric_date,",
		);
	});
});
