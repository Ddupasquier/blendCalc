import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260726225000_product_api_cache_service_role_grants.sql",
	"utf8",
);

describe("product API cache service-role grants migration", () => {
	it("allows server-only cache reads and writes", () => {
		expect(migration).toContain("grant select, insert, update, delete");
		expect(migration).toContain("public.product_api_cache");
		expect(migration).toContain("to service_role");
	});

	it("does not expose the cache to browser roles", () => {
		expect(migration).not.toMatch(/\b(?:anon|authenticated)\b/);
	});
});
