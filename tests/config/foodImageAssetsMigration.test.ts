import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260708170000_food_image_assets.sql",
	"utf8",
);

describe("food image assets migration", () => {
	it("stores approved/source-backed food image metadata", () => {
		expect(migration).toContain("create table if not exists public.food_image_assets");
		expect(migration).toContain("barcode text check");
		expect(migration).toContain(
			"shared_product_id uuid references public.shared_products",
		);
		expect(migration).toContain("image_url text not null");
		expect(migration).toContain("thumbnail_url text");
		expect(migration).toContain("license_name text not null");
		expect(migration).toContain("attribution_text text");
		expect(migration).toContain(
			"source in ('open-food-facts', 'wikimedia-commons', 'community-reviewed')",
		);
	});

	it("indexes common image lookup paths", () => {
		expect(migration).toContain("food_image_assets_active_barcode_role_idx");
		expect(migration).toContain("food_image_assets_shared_product_idx");
		expect(migration).toContain("food_image_assets_generic_role_idx");
		expect(migration).toContain("food_image_assets_source_reference_role_idx");
	});

	it("keeps image assets canonical and read-only for users", () => {
		expect(migration).toContain(
			"alter table public.food_image_assets force row level security",
		);
		expect(migration).toContain(
			"Authenticated users can read active food images",
		);
		expect(migration).toMatch(
			/revoke all on table public\.food_image_assets\s+from public, anon, authenticated/,
		);
		expect(migration).toContain(
			"grant select on table public.food_image_assets to authenticated",
		);
		expect(migration).toContain(
			"grant all on table public.food_image_assets to service_role",
		);
	});
});
