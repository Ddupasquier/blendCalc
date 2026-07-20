import {
	resolveFoodSymbolKey,
} from "$lib/utils/food/reference/appReferenceCatalog";
import { describe, expect, it } from "vitest";

describe("food symbol resolution", () => {
	it("keeps a valid stored symbol key", () => {
		expect(resolveFoodSymbolKey({ symbolKey: "fruit" })).toBe("fruit");
	});

	it("uses the DB-loaded category rules when an older food has no symbol key", () => {
		expect(
			resolveFoodSymbolKey({ foodCategory: "Fruits and Fruit Juices" }),
		).toBe("fruit");
		expect(
			resolveFoodSymbolKey({ foodCategory: "Vegetables and Vegetable Products" }),
		).toBe("vegetables");
	});

	it("uses specific DB rules for common food groups", () => {
		expect(resolveFoodSymbolKey({ foodCategory: "Protein Bars" })).toBe(
			"protein-bar",
		);
		expect(resolveFoodSymbolKey({ foodCategory: "Jams and Preserves" })).toBe(
			"spreads-preserves",
		);
		expect(resolveFoodSymbolKey({ foodCategory: "Dips and Salsa" })).toBe(
			"sauces-condiments",
		);
		expect(
			resolveFoodSymbolKey({ foodCategory: "Legumes and Legume Products" }),
		).toBe("legumes");
	});

	it("replaces a stored generic fallback when a DB category rule now matches", () => {
		expect(
			resolveFoodSymbolKey({
				symbolKey: "generic",
				foodCategory: "Pasta and Noodle Products",
			}),
		).toBe("pasta-noodles");
	});

	it("uses the food name when a generic category has no useful match", () => {
		expect(
			resolveFoodSymbolKey({
				symbolKey: "generic",
				description: "Peanut Butter",
				foodCategory: "Custom Ingredient",
			}),
		).toBe("nuts-seeds");
	});

	it("uses the generic symbol when no DB rule matches", () => {
		expect(resolveFoodSymbolKey({ foodCategory: "Unknown category" })).toBe(
			"generic",
		);
	});
});
