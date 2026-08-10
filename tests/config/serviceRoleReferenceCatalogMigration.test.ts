import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260725103000_service_role_reference_catalog_reads.sql",
	"utf8",
);

describe("service-role reference catalog migration", () => {
	it("allows the server reference catalog to read nutrient definitions", () => {
		expect(migration).toContain(
			"grant select on table public.nutrient_definitions to service_role",
		);
		expect(migration).toContain(
			"grant select on table public.compatibility_tags to service_role",
		);
	});
});
