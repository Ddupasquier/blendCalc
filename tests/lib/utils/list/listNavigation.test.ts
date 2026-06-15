import { describe, expect, it } from "vitest";
import {
	clampPage,
	filterItemsByQuery,
	getPageCount,
	getPaginationItems,
	paginateItems,
	sortFoodListItems,
} from "$lib/utils/list/listNavigation";

describe("list navigation", () => {
	it("matches every word in a search query", () => {
		const items = ["Raw kale", "Kale chips", "Raw spinach"];

		expect(filterItemsByQuery(items, "kale raw", (item) => item)).toEqual([
			"Raw kale",
		]);
	});

	it("calculates and clamps pages", () => {
		expect(getPageCount(25, 10)).toBe(3);
		expect(clampPage(6, 25, 10)).toBe(3);
		expect(clampPage(0, 25, 10)).toBe(1);
	});

	it("returns the requested page of items", () => {
		expect(paginateItems([1, 2, 3, 4, 5], 2, 2)).toEqual([3, 4]);
	});

	it("keeps deep pagination compact", () => {
		expect(getPaginationItems(5, 10)).toEqual([
			1,
			"ellipsis",
			4,
			5,
			6,
			"ellipsis",
			10,
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
