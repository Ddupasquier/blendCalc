import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	resolve(
		"supabase/migrations/20260829090000_provider_cache_observability.sql",
	),
	"utf8",
);

describe("provider cache observability migration", () => {
	it("adds privacy-safe cache outcomes and bounded maintenance", () => {
		expect(migration).toContain("cache_miss_count bigint");
		expect(migration).toContain("stale_fallback_count bigint");
		expect(migration).toContain("coalesced_request_count bigint");
		expect(migration).toContain("cleanup_expired_product_api_cache");
		expect(migration).toContain("limit p_limit");
		expect(migration).not.toContain("user_id");
	});

	it("keeps budgets and cache health service-only", () => {
		expect(migration).toContain(
			"create table public.product_source_request_budgets",
		);
		expect(migration).toContain(
			"create function public.get_product_api_cache_health",
		);
		expect(migration).toContain("force row level security");
		expect(migration).toContain(
			"grant execute on function public.get_product_api_cache_health()",
		);
		expect(migration).not.toContain(
			"grant select on table public.product_source_request_budgets to authenticated",
		);
	});
});
