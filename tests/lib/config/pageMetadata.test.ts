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
		expect(getAppDocumentTitle(url("/mix"))).toBe(
			"Smoothie Builder · blendCalc",
		);
		expect(getAppDocumentTitle(url("/saved"))).toBe(
			"Saved Smoothies · blendCalc",
		);
	});

	it("describes ingredient subviews and selected foods", () => {
		expect(getAppDocumentTitle(url("/fridge/shopping-list"))).toBe(
			"Shopping List · blendCalc",
		);
		expect(getAppDocumentTitle(url("/fridge/barcode-scanner"))).toBe(
			"Scan a Barcode · blendCalc",
		);
		expect(
			getAppDocumentTitle(
				url("/fridge/nutrition/42"),
				"Roasted Tomato Soup",
			),
		).toBe("Roasted Tomato Soup Nutrition · blendCalc");
	});

	it("uses readable paths without transient query parameters as canonicals", () => {
		expect(
			getCanonicalAppUrl(
				url("/fridge/shopping-list?sort=recent#saved-ingredients"),
			),
		).toBe("https://blendcalc.vercel.app/fridge/shopping-list");
	});
});
