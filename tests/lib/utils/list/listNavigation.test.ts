import { describe, expect, it } from "vitest";
import {
	filterItemsByQuery,
	sortFoodListItems,
} from "$lib/utils/list/listNavigation";

describe("list navigation", () => {
	it("matches every word in a search query", () => {
		const items = ["Raw kale", "Kale chips", "Raw spinach"];

		expect(filterItemsByQuery(items, "kale raw", (item) => item)).toEqual([
			"Raw kale",
		]);
	});

	it("sorts food lists by newest first using list timestamps", () => {
		const items = [
			{ name: "Apple", addedAt: 100 },
			{ name: "Banana", addedAt: 300 },
			{ name: "Carrot", addedAt: 200 },
		];

		expect(
			sortFoodListItems(
				items,
				"recent",
				(item) => item.name,
				(item) => item.addedAt,
			).map((item) => item.name),
		).toEqual(["Banana", "Carrot", "Apple"]);
	});

	it("falls back to reverse list order for untimestamped foods", () => {
		const items = [{ name: "Apple" }, { name: "Banana" }, { name: "Carrot" }];

		expect(
			sortFoodListItems(
				items,
				"recent",
				(item) => item.name,
				() => undefined,
			).map((item) => item.name),
		).toEqual(["Carrot", "Banana", "Apple"]);
	});

	it("sorts food lists alphabetically both directions", () => {
		const items = [{ name: "Banana" }, { name: "Carrot" }, { name: "Apple" }];
		const getName = (item: { name: string }) => item.name;

		expect(sortFoodListItems(items, "name-asc", getName, () => undefined).map(getName)).toEqual([
			"Apple",
			"Banana",
			"Carrot",
		]);
		expect(sortFoodListItems(items, "name-desc", getName, () => undefined).map(getName)).toEqual([
			"Carrot",
			"Banana",
			"Apple",
		]);
	});
});
