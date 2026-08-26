import { describe, expect, it } from "vitest";
import {
	BlendCalcAPIV1RequestError,
	readBlendCalcAPIV1CategoryRequest,
	readBlendCalcAPIV1RevisionHistoryRequest,
	readBlendCalcAPIV1SearchRequest,
} from "$lib/blendCalcAPI/v1/blendCalcAPIRequest";

describe("blendCalcAPI v1 request validation", () => {
	it("uses bounded search defaults", () => {
		expect(
			readBlendCalcAPIV1SearchRequest(
				new URL("https://blendcalc.test/api/v1/foods/search?q=tomato"),
			),
		).toEqual({ query: "tomato", limit: 15, offset: 0 });
	});

	it("accepts explicit whole-number pagination", () => {
		expect(
			readBlendCalcAPIV1CategoryRequest(
				new URL("https://blendcalc.test/api/v1/categories?limit=25&offset=50"),
			),
		).toEqual({ limit: 25, offset: 50 });
		expect(
			readBlendCalcAPIV1RevisionHistoryRequest(
				new URL(
					"https://blendcalc.test/api/v1/products/00021130493609/revisions?limit=10&offset=20",
				),
			),
		).toEqual({ limit: 10, offset: 20 });
	});

	it.each([
		"?q=t",
		"?q=tomato&limit=51",
		"?q=tomato&limit=1.5",
		"?q=tomato&offset=1001",
	])("rejects invalid search input %s", (search) => {
		expect(() =>
			readBlendCalcAPIV1SearchRequest(
				new URL(`https://blendcalc.test/api/v1/foods/search${search}`),
			),
		).toThrow(BlendCalcAPIV1RequestError);
	});

	it("bounds revision-history pagination independently", () => {
		expect(() =>
			readBlendCalcAPIV1RevisionHistoryRequest(
				new URL(
					"https://blendcalc.test/api/v1/products/00021130493609/revisions?limit=101",
				),
			),
		).toThrow(BlendCalcAPIV1RequestError);
		expect(() =>
			readBlendCalcAPIV1RevisionHistoryRequest(
				new URL(
					"https://blendcalc.test/api/v1/products/00021130493609/revisions?offset=1001",
				),
			),
		).toThrow(BlendCalcAPIV1RequestError);
	});
});
