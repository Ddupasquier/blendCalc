import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260801102000_service_role_catalog_read_dependencies.sql",
	"utf8",
);

describe("service-role catalog read dependencies migration", () => {
	it("allows trusted server catalog hydration to read its reference and evidence dependencies", () => {
		expect(migration).toContain(
			"grant select on table public.custom_food_category_options to service_role",
		);
		expect(migration).toContain(
			"grant select on table public.shared_product_observations to service_role",
		);
	});
});
