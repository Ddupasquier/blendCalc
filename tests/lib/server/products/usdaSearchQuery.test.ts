import { describe, expect, it } from "vitest";
import {
	buildUsdaExactSearchQuery,
	buildUsdaPartialSearchQuery,
} from "$lib/server/products/usdaSearchQuery";

describe("USDA partial search query", () => {
	it("requires complete search words before using partial matching", () => {
		expect(buildUsdaExactSearchQuery("tomato")).toBe("+tomato");
		expect(buildUsdaExactSearchQuery("green tomato")).toBe("+green +tomato");
	});

	it("adds partial-word matching to unfinished search terms", () => {
		expect(buildUsdaPartialSearchQuery("tomat")).toBe("+tomat*");
		expect(buildUsdaPartialSearchQuery("green tomat")).toBe("+green* +tomat*");
	});

	it("normalizes punctuation and limits oversized searches", () => {
		expect(buildUsdaPartialSearchQuery("  Tomato,   raw! ")).toBe("+tomato* +raw*");
		expect(buildUsdaPartialSearchQuery("one two three four five six seven"))
			.toBe("+one* +two* +three* +four* +five* +six*");
	});
});
