import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260718000000_server_request_efficiency.sql",
	"utf8",
);

describe("server request efficiency migration", () => {
	it("allows reusable provider cache keys without provider-specific migrations", () => {
		expect(migration).toContain("drop constraint if exists product_api_cache_provider_check");
		expect(migration).toContain("provider ~ '^[a-z0-9]+(-[a-z0-9]+)*$'");
		expect(migration).toContain("request_kind ~ '^[a-z0-9]+(-[a-z0-9]+)*$'");
	});

	it("supports one-call food image upserts", () => {
		expect(migration).toContain("drop index if exists public.food_image_assets_source_reference_role_idx");
		expect(migration).toContain(
			"on public.food_image_assets (source, source_reference, image_role)",
		);
		expect(migration).not.toContain("where source_reference is not null");
	});
});
