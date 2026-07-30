import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260730130000_barcode_nutrition_audit_corrections.sql",
	"utf8",
);

describe("barcode nutrition audit corrections migration", () => {
	it("uses the authoritative FDA Vitamin D conversion", () => {
		expect(migration).toContain("multiplier = 0.025");
		expect(migration).toContain(
			"https://www.fda.gov/media/129863/download",
		);
		expect(migration).toContain(
			"conversion_method = 'moderator_verified'",
		);
		expect(migration).not.toContain("api_observed_ratio");
	});

	it("removes unsupported zero nutrients instead of treating missing as zero", () => {
		expect(migration).toContain(
			"nutrient.value_origin = 'derived'",
		);
		expect(migration).toContain("nutrient.source = 'unknown'");
		expect(migration).toContain(
			"nutrient.source_observation_id is null",
		);
		expect(migration).toContain(
			"Removed zero values that were not reported by any source.",
		);
	});

	it("corrects the exact almondmilk barcode from serving values to per-100g", () => {
		expect(migration).toContain("'00041570054130'");
		expect(migration).toContain("'2757275'");
		expect(migration).toContain("(1008, 12.5, 'KCAL', 30)");
		expect(migration).toContain("(1093, 70.8333, 'MG', 170)");
		expect(migration).toContain(
			"Corrected USDA 240 g label-serving values to the canonical per-100 g basis.",
		);
	});

	it("records exact source evidence, provenance, and catalog revisions", () => {
		expect(migration).toContain(
			"insert into public.shared_product_observations",
		);
		expect(migration).toContain(
			"insert into public.shared_product_field_provenance",
		);
		expect(migration).toContain(
			"insert into public.shared_product_revisions",
		);
		expect(migration).toContain("'exact-barcode'");
		expect(migration).toContain("'CC0-1.0'");
	});

	it("backfills linked user list snapshots and verifies the result", () => {
		expect(migration).toContain(
			"update public.user_food_list_items item",
		);
		expect(migration).toContain(
			"where item.shared_product_id = product.id",
		);
		expect(migration).toContain(
			"Unsupported shared-catalog zero nutrient rows remain",
		);
		expect(migration).toContain(
			"Almondmilk per-100g energy was not corrected",
		);
	});
});
