import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260719222000_food_symbol_category_rules.sql",
	"utf8",
);
const foodSymbol = readFileSync(
	"src/lib/assets/icons/FoodSymbol.svelte",
	"utf8",
);

describe("food symbol reference catalog", () => {
	it("assigns category symbols through ordered database rules", () => {
		expect(migration).toContain("create table public.food_symbol_category_rules");
		expect(migration).toContain("resolve_food_symbol_key");
		expect(migration).toContain("set_custom_food_category_symbol_key");
	});

	it("renders the stored symbol key without client keyword guessing", () => {
		expect(foodSymbol).toContain("symbolKey={food.symbolKey}");
		expect(foodSymbol).not.toContain("keywords");
		expect(foodSymbol).not.toMatch(/[🥤🍬🧈🥛🥩🐟🌾🌰🥬🍓📦🥣]/u);
	});
});
