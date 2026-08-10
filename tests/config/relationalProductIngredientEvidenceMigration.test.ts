import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260731120000_relational_product_ingredient_evidence.sql",
	"utf8",
);

describe("relational product ingredient evidence migration", () => {
	it("stores source statements and ordered nested ingredient components", () => {
		expect(migration).toContain(
			"create table public.product_ingredient_statements",
		);
		expect(migration).toContain(
			"create table public.product_ingredient_components",
		);
		expect(migration).toContain("source_path integer[] not null");
		expect(migration).toContain("parent_component_id uuid");
		expect(migration).toContain("percent_exact numeric");
		expect(migration).toContain("percent_estimate numeric");
	});

	it("keeps ingredient taxonomy and derivative relationships review gated", () => {
		expect(migration).toContain("create table public.ingredient_terms");
		expect(migration).toContain(
			"create table public.ingredient_term_aliases",
		);
		expect(migration).toContain(
			"create table public.ingredient_term_relationships",
		);
		expect(migration).toContain(
			"conflict_inheritance text not null default 'none'",
		);
		expect(migration).not.toContain("insert into public.ingredient_terms");
	});

	it("links ingredient facts to exact components, DB rules, and policy versions", () => {
		expect(migration).toContain("add column ingredient_component_id uuid");
		expect(migration).toContain("add column match_rule_id uuid");
		expect(migration).toContain(
			"create or replace function public.link_product_compatibility_fact_ingredient()",
		);
		expect(migration).toContain("rule.field_name = 'ingredients'");
		expect(migration).toContain(
			"policy_version_id records the policy version evaluated",
		);
	});

	it("does not split an unstructured statement or infer percentages", () => {
		expect(migration).toContain("v_extraction_method := 'raw-statement'");
		expect(migration).toContain(
			"if v_extraction_method = 'reported-tree' then",
		);
		expect(migration).toContain(
			"elsif v_extraction_method = 'reported-list' then",
		);
		expect(migration).not.toMatch(/regexp_split_to_(?:array|table)/);
	});
});
