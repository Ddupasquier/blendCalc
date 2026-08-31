import { describe, expect, it } from "vitest";
import {
	BLENDCALC_API_V1_PAGINATION_LIMITS,
	BlendCalcAPIV1RequestError,
	readBlendCalcAPIV1BarcodePathParameter,
	readBlendCalcAPIV1CategoryRequest,
	readBlendCalcAPIV1ProductRequest,
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

	it("accepts every documented pagination boundary", () => {
		expect(
			readBlendCalcAPIV1SearchRequest(
				new URL(
					`https://blendcalc.test/api/v1/foods/search?q=tomato&limit=${BLENDCALC_API_V1_PAGINATION_LIMITS.search.maximumLimit}&offset=${BLENDCALC_API_V1_PAGINATION_LIMITS.maximumOffset}`,
				),
			),
		).toEqual({
			query: "tomato",
			limit: BLENDCALC_API_V1_PAGINATION_LIMITS.search.maximumLimit,
			offset: BLENDCALC_API_V1_PAGINATION_LIMITS.maximumOffset,
		});
		expect(
			readBlendCalcAPIV1CategoryRequest(
				new URL(
					`https://blendcalc.test/api/v1/categories?limit=${BLENDCALC_API_V1_PAGINATION_LIMITS.categories.maximumLimit}&offset=0`,
				),
			),
		).toEqual({
			limit: BLENDCALC_API_V1_PAGINATION_LIMITS.categories.maximumLimit,
			offset: 0,
		});
		expect(
			readBlendCalcAPIV1RevisionHistoryRequest(
				new URL(
					`https://blendcalc.test/api/v1/products/00021130493609/revisions?limit=${BLENDCALC_API_V1_PAGINATION_LIMITS.revisions.maximumLimit}&offset=0`,
				),
			),
		).toEqual({
			limit: BLENDCALC_API_V1_PAGINATION_LIMITS.revisions.maximumLimit,
			offset: 0,
		});
	});

	it.each([
		"?q=t",
		"?q=tomato&limit=51",
		"?q=tomato&limit=1.5",
		"?q=tomato&limit=1e1",
		"?q=tomato&limit=01",
		"?q=tomato&offset=+1",
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

	it.each([
		["categories", readBlendCalcAPIV1CategoryRequest, "?limit=0"],
		["categories", readBlendCalcAPIV1CategoryRequest, "?limit=101"],
		["categories", readBlendCalcAPIV1CategoryRequest, "?offset=-1"],
		["categories", readBlendCalcAPIV1CategoryRequest, "?offset=1.5"],
		["revisions", readBlendCalcAPIV1RevisionHistoryRequest, "?limit=0"],
		["revisions", readBlendCalcAPIV1RevisionHistoryRequest, "?offset=-1"],
	])("rejects invalid %s pagination %s", (_, readRequest, search) => {
		expect(() =>
			readRequest(new URL(`https://blendcalc.test/api/v1/example${search}`)),
		).toThrow(BlendCalcAPIV1RequestError);
	});

	it.each([
		new URL("https://blendcalc.test/api/v1/foods/search?q=tomato&q=potato"),
		new URL("https://blendcalc.test/api/v1/foods/search?q=tomato&private=true"),
		new URL(
			`https://blendcalc.test/api/v1/foods/search?q=${"a".repeat(2_100)}`,
		),
	])("rejects an unbounded or ambiguous query shape", (url) => {
		expect(() => readBlendCalcAPIV1SearchRequest(url)).toThrow(
			BlendCalcAPIV1RequestError,
		);
	});

	it("rejects query parameters on exact-product reads", () => {
		expect(() =>
			readBlendCalcAPIV1ProductRequest(
				new URL(
					"https://blendcalc.test/api/v1/products/00021130493609?include=private",
				),
			),
		).toThrow(BlendCalcAPIV1RequestError);
	});

	it("normalizes only a strict valid GTIN path value", () => {
		expect(readBlendCalcAPIV1BarcodePathParameter("0021130493609")).toBe(
			"00021130493609",
		);
	});

	it.each([
		"00211-30493609",
		" 0021130493609",
		"0021130493609 ",
		"product-0021130493609",
		"0021130493600",
	])("rejects a malformed or invalid GTIN path value %s", (barcode) => {
		expect(() => readBlendCalcAPIV1BarcodePathParameter(barcode)).toThrow(
			BlendCalcAPIV1RequestError,
		);
	});
});
