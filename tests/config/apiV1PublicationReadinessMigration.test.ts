import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260726210000_api_v1_publication_readiness.sql",
	"utf8",
);

describe("API v1 publication readiness migration", () => {
	it("adds an explicit database-owned redistribution decision", () => {
		expect(migration).toContain(
			"api_redistribution_allowed boolean not null default false",
		);
		expect(migration).toContain(
			"where key in ('usda', 'health-canada-cnf', 'uk-cofid')",
		);
		expect(migration).toContain("canonical_storage_allowed");
		expect(migration).toContain("canonical_policy_reviewed_at is not null");
		expect(migration).toContain("canonical_license_name");
		expect(migration).toContain("attribution_text");
	});

	it("backfills ingredient provenance only from exact stored USDA evidence", () => {
		expect(migration).toContain(
			"create temporary table api_v1_ingredient_provenance_backfill",
		);
		expect(migration).toContain("observation.source = 'usda'");
		expect(migration).toContain(
			"observation.source_reference is not distinct from product.source_reference",
		);
		expect(migration).toContain(
			"lower(btrim(product.food ->> 'ingredients'))",
		);
		expect(migration).toContain("'exact-barcode'");
		expect(migration).toContain("'provenanceBackfill'");
	});

	it("backfills category provenance only through exact stored category mappings", () => {
		expect(migration).toContain(
			"create temporary table api_v1_category_provenance_backfill",
		);
		expect(migration).toContain(
			"join public.custom_food_category_observations category_observation",
		);
		expect(migration).toContain(
			"category_mapping.category_option_id = product.category_option_id",
		);
		expect(migration).toContain(
			"category_mapping.confidence = 'exact'",
		);
		expect(migration).toContain(
			"category_observation.source = 'fdc-branded-detail' then 'usda'",
		);
	});

	it("requires canonical provenance and normalized nutrition before publication", () => {
		expect(migration).toContain(
			"blendcalc_api_v1_product_readiness_reasons",
		);
		expect(migration).toContain("'missing_field_provenance:categories'");
		expect(migration).toContain("'missing_normalized_nutrients'");
		expect(migration).toContain("'field_source_not_redistributable'");
		expect(migration).toContain("'nutrient_source_not_redistributable'");
		expect(migration).toContain("'serving_source_not_redistributable'");
	});

	it("filters both catalog read RPCs through the publication gate", () => {
		expect(migration.match(
			/public\.blendcalc_api_v1_product_readiness_reasons\(product\.id\)/g,
		)?.length).toBeGreaterThanOrEqual(2);
		expect(migration).toContain(
			"create or replace function public.get_blendcalc_product_v1",
		);
		expect(migration).toContain(
			"create or replace function public.search_blendcalc_products_v1",
		);
	});

	it("keeps readiness diagnostics private", () => {
		expect(migration).toContain(
			"revoke all on table public.blendcalc_api_v1_product_readiness",
		);
		expect(migration).toContain(
			"grant select on table public.blendcalc_api_v1_product_readiness",
		);
		expect(migration).toContain("to service_role");
	});
});
