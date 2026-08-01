import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260731164000_multilingual_ingredient_policy.sql",
	"utf8",
);

describe("multilingual ingredient policy migration", () => {
	it("stores reviewed aliases in an immutable policy version", () => {
		expect(migration).toContain(
			"public.create_food_compatibility_policy_draft(\n\t\t2,",
		);
		expect(migration).toContain("language_code");
		expect(migration).toContain("'fr'");
		expect(migration).toContain("'es'");
		expect(migration).not.toContain("similarity(");
	});

	it("retains threshold and product context without suppressing warnings", () => {
		expect(migration).toContain("threshold_value");
		expect(migration).toContain("product_context");
		expect(migration).toContain("'context-only'");
		expect(migration).toContain("fully-refined-soybean-oil");
	});

	it("derives facts only from reviewed aliases and structured evidence", () => {
		expect(migration).toContain(
			"food_compatibility_policy_preference_term_mappings mapping",
		);
		expect(migration).toContain("product_ingredient_components component");
		expect(migration).not.toContain("p_food ->> 'description'");
		expect(migration).not.toContain("p_food ->> 'brandOwner'");
	});
});
