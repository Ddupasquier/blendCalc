import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260829230000_product_source_field_accuracy_metrics.sql",
	"utf8",
);

describe("product source field accuracy metrics migration", () => {
	it("stores field-level outcomes without exposing them to application roles", () => {
		expect(migration).toContain(
			"create table public.product_source_field_daily_metrics",
		);
		expect(migration).toContain("cross_source_disagreement_count");
		expect(migration).toContain("confirmed_label_correction_count");
		expect(migration).toContain(
			"revoke all on table public.product_source_field_daily_metrics",
		);
		expect(migration).toContain("to service_role");
	});

	it("records batches through one service-only database function", () => {
		expect(migration).toContain(
			"create function public.record_product_source_field_daily_metrics",
		);
		expect(migration).toContain("jsonb_to_recordset(p_metric_increments)");
		expect(migration).toContain(
			"grant execute on function public.record_product_source_field_daily_metrics(jsonb)",
		);
	});
});
