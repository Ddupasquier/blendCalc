import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260814121000_register_cola_cloud_source.sql",
	"utf8",
);

describe("COLA Cloud source registration", () => {
	it("registers a server-only trial source without granting canonical or API rights", () => {
		expect(migration).toContain("'cola-cloud'");
		expect(migration).toContain("'us_alcohol_exact_barcode_fallback'");
		expect(migration).toContain("canonical_storage_allowed");
		expect(migration).toContain("api_redistribution_allowed");
		expect(migration).toMatch(/true,\s*false,\s*null,/);
		expect(migration).toContain("'publicApiEligible', false");
	});

	it("records the bounded smoke check without pretending it is a full benchmark", () => {
		expect(migration).toContain("'trial'");
		expect(migration).toContain("'representative_benchmark_pending'");
		expect(migration).toContain("'649754706570'");
	});
});
