import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260726180000_ingredient_evidence_only_compatibility.sql",
	"utf8",
);

describe("ingredient-evidence-only compatibility migration", () => {
	it("removes title and category inference from active compatibility rules", () => {
		expect(migration).toContain("where source_type = 'source_food_identity'");
		expect(migration).toContain("where field_name <> 'ingredients'");
		expect(migration).toContain("check (field_name = 'ingredients')");
		expect(migration).toContain("check (source_type = 'label_ingredient_field')");
	});

	it("rebuilds facts from source-provided ingredient statements only", () => {
		expect(migration).toContain("v_product.food ->> 'ingredients'");
		expect(migration).toContain("rule.field_name = 'ingredients'");
		expect(migration).toContain("rule.source_type = 'label_ingredient_field'");
		expect(migration).not.toContain("when 'description'");
		expect(migration).not.toContain("when 'food_category'");
		expect(migration).toContain(
			"select public.refresh_shared_product_compatibility_match_facts(product.id)",
		);
	});

	it("retires issue codes that described inferred product identity", () => {
		expect(migration).toContain("'FOOD_IDENTITY_CONFIRMED'");
		expect(migration).toContain("'FOOD_IDENTITY_POSSIBLE'");
	});
});
