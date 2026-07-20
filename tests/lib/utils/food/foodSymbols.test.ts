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

	it("uses the generic symbol when no DB rule matches", () => {
		expect(resolveFoodSymbolKey({ foodCategory: "Unknown category" })).toBe(
			"generic",
		);
	});
});
