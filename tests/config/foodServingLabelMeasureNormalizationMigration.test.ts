import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260722220000_food_serving_label_measure_normalization.sql",
	"utf8",
);

describe("food serving label measure normalization migration", () => {
	it("derives recognized volume quantities from exact serving labels", () => {
		expect(migration).toContain("create function public.apply_food_serving_label_measure()");
		expect(migration).toContain("regexp_match");
		expect(migration).toContain("public.serving_measure_aliases");
		expect(migration).toContain("unit.dimension = 'volume'");
		expect(migration).toContain("new.amount := v_amount");
		expect(migration).toContain("new.unit_key := v_unit_key");
	});

	it("preserves explicit volume data and repairs existing normalized rows", () => {
		expect(migration).toContain("if v_current_dimension = 'volume' then");
		expect(migration).toContain("before insert or update of label, gram_weight, amount, unit_key");
		expect(migration).toContain("update public.food_servings");
		expect(migration).toContain("set label = label");
	});
});
