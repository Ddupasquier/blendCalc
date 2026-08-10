import { describe, expect, it } from "vitest";
import {
	formatDocumentTitle,
	getAppDocumentTitle,
	getCanonicalAppUrl,
} from "$lib/config/pageMetadata";

const url = (path: string) => new URL(path, "https://blendcalc.test");

describe("page metadata", () => {
	it("puts the useful view name before the app name", () => {
		expect(formatDocumentTitle("Shopping List")).toBe(
			"Shopping List · blendCalc",
		);
		expect(getAppDocumentTitle(url("/mix"))).toBe("Mix · blendCalc");
		expect(getAppDocumentTitle(url("/saved"))).toBe(
			"Saved Recipes · blendCalc",
		);
		expect(getAppDocumentTitle(url("/saved/sort"))).toBe(
			"Sort Saved Recipes · blendCalc",
		);
	});

	it("describes ingredient subviews and selected foods", () => {
		expect(getAppDocumentTitle(url("/ingredients/shopping"))).toBe(
			"Shopping List · blendCalc",
		);
		expect(
			getAppDocumentTitle(url("/ingredients/fridge/barcode-scanner")),
		).toBe(
			"Scan a Barcode · blendCalc",
		);
		expect(
			getAppDocumentTitle(
				url("/ingredients/fridge/nutrition/42"),
				"Roasted Tomato Soup",
			),
		).toBe("Roasted Tomato Soup Nutrition · blendCalc");
		expect(getAppDocumentTitle(url("/mix/save"))).toBe(
			"Save Mix · blendCalc",
		);
		expect(getAppDocumentTitle(url("/mix/options"))).toBe(
			"Mix Options · blendCalc",
		);
		expect(getAppDocumentTitle(url("/mix/reorganize"))).toBe(
			"Reorganize Mix · blendCalc",
		);
	});

	it("uses readable paths without transient query parameters as canonicals", () => {
		expect(
			getCanonicalAppUrl(
				url("/ingredients/shopping?sort=recent#saved-ingredients"),
			),
		).toBe("https://blendcalc.vercel.app/ingredients/shopping");
	});
});
