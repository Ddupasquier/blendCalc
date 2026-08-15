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
		).toBe("pasta");
	});

	it("replaces an older broad stored symbol with a more specific DB match", () => {
		expect(
			resolveFoodSymbolKey({
				symbolKey: "meat",
				description: "Pork chorizo",
				foodCategory: "Meat products",
			}),
		).toBe("sausage");
		expect(
			resolveFoodSymbolKey({
				symbolKey: "fruit",
				description: "Banana, raw",
				foodCategory: "Fruits and Fruit Juices",
			}),
		).toBe("banana");
	});

	it("uses specific symbols for alcohol, soups, produce, and assorted meats", () => {
		const examples = [
			["Cabernet Sauvignon wine", "wine"],
			["Craft lager beer", "beer"],
			["Small batch whiskey", "spirits"],
			["Ginger kombucha", "kombucha"],
			["Chicken noodle soup", "noodle-soup"],
			["Avocado, raw", "avocado"],
			["Tomatoes, roma", "tomato"],
			["Beef ribeye steak", "beef"],
			["Shrimp, canned", "shellfish"],
		] as const;

		for (const [description, symbolKey] of examples) {
			expect(resolveFoodSymbolKey({ description })).toBe(symbolKey);
		}
	});

	it("distinguishes prepared forms and specific foods from broad categories", () => {
		const examples = [
			["Turkey sandwich", "sandwich"],
			["Tomato salad", "salad"],
			["Tortilla chips", "chips"],
			["Ahi salmon poke", "food-bowl"],
			["Classic hummus", "hummus"],
			["Beer bread", "bread"],
			["Chicken pasta", "pasta"],
			["Atlantic salmon", "salmon"],
			["Roasted duck", "duck"],
			["Espresso coffee", "coffee"],
			["Whole milk", "milk"],
			["Baby spinach", "spinach"],
			["Russet potato", "potato"],
		] as const;

		for (const [description, symbolKey] of examples) {
			expect(resolveFoodSymbolKey({ description })).toBe(symbolKey);
		}
	});

	it("uses the poop symbol only for whole-word feces synonyms", () => {
		for (const description of ["poop", "shit", "caca", "a tiny turd"]) {
			expect(resolveFoodSymbolKey({ description })).toBe("poop");
		}

		expect(resolveFoodSymbolKey({ description: "Shiitake mushrooms" })).toBe(
			"mushrooms",
		);
		expect(resolveFoodSymbolKey({ description: "Cacao powder" })).not.toBe(
			"poop",
		);
	});

	it("keeps short food terms from matching letters inside unrelated words", () => {
		expect(resolveFoodSymbolKey({ description: "Beef ribeye steak" })).toBe(
			"beef",
		);
		expect(resolveFoodSymbolKey({ description: "Spinach, boiled" })).toBe(
			"spinach",
		);
		expect(resolveFoodSymbolKey({ description: "Goat meat" })).toBe(
			"lamb-game",
		);
		expect(resolveFoodSymbolKey({ description: "Coconut, raw" })).toBe(
			"coconut",
		);
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
