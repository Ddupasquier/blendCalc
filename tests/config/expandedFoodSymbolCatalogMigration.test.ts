import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260720010000_expand_food_symbol_catalog.sql",
	"utf8",
);
const iconComponent = readFileSync(
	"src/lib/assets/icons/CategoryFoodIcon.svelte",
	"utf8",
);

const expectedSymbolKeys = [
	"berries",
	"citrus",
	"leafy-greens",
	"root-vegetables",
	"eggs",
	"poultry",
	"bread-bakery",
	"pasta-noodles",
	"legumes",
	"coffee-tea",
	"frozen-dessert",
	"spreads-preserves",
	"sauces-condiments",
	"soup",
	"protein-bar",
];

describe("expanded food symbol catalog migration", () => {
	it("adds a focused set of useful category symbols", () => {
		for (const key of expectedSymbolKeys) {
			expect(migration).toContain(`('${key}'`);
			expect(iconComponent).toContain(`symbolKey === "${key}"`);
		}
	});

	it("keeps category assignment database-driven and refreshes stored foods", () => {
		expect(migration).toContain("food_symbol_category_rules");
		expect(migration).toContain("resolve_food_symbol_key(normalized_value)");
		expect(migration).toContain("update public.user_food_list_items");
		expect(migration).toContain("update public.shared_products");
		expect(migration).toContain("update public.custom_foods");
	});
});
