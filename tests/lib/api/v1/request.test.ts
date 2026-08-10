import { describe, expect, it } from "vitest";
import {
	ApiV1RequestError,
	readApiV1CategoryRequest,
	readApiV1RevisionHistoryRequest,
	readApiV1SearchRequest,
} from "$lib/api/v1/request";

describe("blendCalc API v1 request validation", () => {
	it("uses bounded search defaults", () => {
		expect(readApiV1SearchRequest(
			new URL("https://blendcalc.test/api/v1/foods/search?q=tomato"),
		)).toEqual({ query: "tomato", limit: 15, offset: 0 });
	});

	it("accepts explicit whole-number pagination", () => {
		expect(readApiV1CategoryRequest(
			new URL("https://blendcalc.test/api/v1/categories?limit=25&offset=50"),
		)).toEqual({ limit: 25, offset: 50 });
		expect(readApiV1RevisionHistoryRequest(
			new URL(
				"https://blendcalc.test/api/v1/products/00021130493609/revisions?limit=10&offset=20",
			),
		)).toEqual({ limit: 10, offset: 20 });
	});

	it.each([
		"?q=t",
		"?q=tomato&limit=51",
		"?q=tomato&limit=1.5",
		"?q=tomato&offset=1001",
	])("rejects invalid search input %s", (search) => {
		expect(() => readApiV1SearchRequest(
			new URL(`https://blendcalc.test/api/v1/foods/search${search}`),
		)).toThrow(ApiV1RequestError);
	});

	it("bounds revision-history pagination independently", () => {
		expect(() => readApiV1RevisionHistoryRequest(
			new URL(
				"https://blendcalc.test/api/v1/products/00021130493609/revisions?limit=101",
			),
		)).toThrow(ApiV1RequestError);
		expect(() => readApiV1RevisionHistoryRequest(
			new URL(
				"https://blendcalc.test/api/v1/products/00021130493609/revisions?offset=1001",
			),
		)).toThrow(ApiV1RequestError);
	});
});
