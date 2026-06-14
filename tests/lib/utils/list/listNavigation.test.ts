import { describe, expect, it } from "vitest";
import {
	clampPage,
	filterItemsByQuery,
	getPageCount,
	getPaginationItems,
	paginateItems,
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
});
