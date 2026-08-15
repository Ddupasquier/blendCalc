import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260814220000_expand_food_symbol_fallbacks.sql",
	"utf8",
);

describe("expanded food symbol fallback migration", () => {
	it("adds a broad but curated set of specific reusable food symbols", () => {
		for (const symbolKey of [
			"poop",
			"noodle-soup",
			"beer",
			"wine",
			"spirits",
			"kombucha",
			"beef",
			"pork",
			"sausage",
			"shellfish",
			"salmon",
			"duck",
			"lamb",
			"bread",
			"pasta",
			"salad",
			"sandwich",
			"pizza",
			"ice-cream",
			"chips",
			"hummus",
			"food-bowl",
			"casserole",
			"granola",
			"coffee",
			"milk",
			"banana",
			"mango",
			"strawberry",
			"avocado",
			"tomato",
			"spinach",
			"potato",
			"mushrooms",
		]) {
			expect(migration).toContain(`('${symbolKey}'`);
		}
	});

	it("orders compound food forms ahead of their individual ingredients", () => {
		for (const rule of [
			"('sandwich',",
			"('bread',",
			"('pasta',",
			"('milk', '(^|[^a-z])(chocolate milk|",
			"('hot-sauce',",
			"('ice-cream',",
			"('seafood', '(^|[^a-z])(battered fish|",
		]) {
			expect(migration).toContain(rule);
		}
	});

	it("uses whole-word novelty matching without client hardcoding", () => {
		expect(migration).toContain("(^|[^a-z])(poop|poo|shit|caca|");
		expect(migration).toContain("([^a-z]|$)");
		expect(migration).toContain("blendCalc food symbol policy v3");
	});

	it("refreshes every durable food snapshot through the shared resolver", () => {
		expect(migration).toContain("resolve_food_symbol_key_for_food");
		expect(migration).toContain("update public.custom_foods");
		expect(migration).toContain("update public.shared_product_submissions");
		expect(migration).toContain("update public.shared_products");
		expect(migration).toContain("update public.shared_product_revisions");
		expect(migration).toContain("update public.user_food_list_items");
	});
});
