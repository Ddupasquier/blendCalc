import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	resolve("supabase/migrations/20260717210000_product_source_quality_metrics.sql"),
	"utf8",
);

describe("product source quality metrics migration", () => {
	it("stores privacy-safe daily source counters", () => {
		expect(migration).toContain("create table public.product_source_daily_metrics");
		expect(migration).toContain("api_request_count bigint");
		expect(migration).toContain("cache_hit_count bigint");
		expect(migration).toContain("reported_nutrient_total bigint");
		expect(migration).not.toContain("barcode text");
		expect(migration).not.toContain("query text");
	});

	it("uses an atomic service-role-only recorder", () => {
		expect(migration).toContain("create function public.record_product_source_daily_metric");
		expect(migration).toContain("on conflict (metric_date, source_key");
		expect(migration).toContain("security definer");
		expect(migration).toContain("force row level security");
		expect(migration).toContain("grant execute on function public.record_product_source_daily_metric");
	});
});
