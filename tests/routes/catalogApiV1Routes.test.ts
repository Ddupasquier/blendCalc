import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	readApiV1Categories: vi.fn(),
	readApiV1ProductByBarcode: vi.fn(),
	searchApiV1Products: vi.fn(),
}));

vi.mock("$lib/server/api/v1/catalogApi.server", () => ({
	readApiV1Categories: mocks.readApiV1Categories,
	readApiV1ProductByBarcode: mocks.readApiV1ProductByBarcode,
	searchApiV1Products: mocks.searchApiV1Products,
}));

import { GET as getCategories } from "../../src/routes/api/v1/categories/+server";
import { GET as searchFoods } from "../../src/routes/api/v1/foods/search/+server";
import { GET as getProduct } from "../../src/routes/api/v1/products/[barcode]/+server";
import { BLENDCALC_API_V1 } from "$lib/api/v1/types";

const createLocals = (signedIn = true) => ({
	getVerifiedUser: vi.fn().mockResolvedValue(signedIn ? { id: "user-id" } : null),
	supabase: { source: "test" },
});

describe("blendCalc API v1 routes", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("requires a signed-in account", async () => {
		const response = await searchFoods({
			locals: createLocals(false),
			url: new URL("http://localhost/api/v1/foods/search?q=tomato"),
		} as never);

		expect(response.status).toBe(401);
		expect(await response.json()).toMatchObject({
			apiVersion: BLENDCALC_API_V1,
			error: { code: "authentication_required" },
		});
		expect(mocks.searchApiV1Products).not.toHaveBeenCalled();
	});

	it("returns an approved product with a stable envelope", async () => {
		mocks.readApiV1ProductByBarcode.mockResolvedValue({
			id: "product-id",
			barcode: "00021130493609",
		});
		const locals = createLocals();
		const response = await getProduct({
			locals,
			params: { barcode: "00021130493609" },
		} as never);

		expect(response.status).toBe(200);
		expect(response.headers.get("x-blendcalc-api-version")).toBe(
			BLENDCALC_API_V1,
		);
		expect(await response.json()).toEqual({
			apiVersion: BLENDCALC_API_V1,
			data: { id: "product-id", barcode: "00021130493609" },
		});
		expect(mocks.readApiV1ProductByBarcode).toHaveBeenCalledWith(
			locals.supabase,
			"00021130493609",
		);
	});

	it("validates search input before reading the catalog", async () => {
		const response = await searchFoods({
			locals: createLocals(),
			url: new URL("http://localhost/api/v1/foods/search?q=t"),
		} as never);

		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({
			error: { code: "invalid_query" },
		});
		expect(mocks.searchApiV1Products).not.toHaveBeenCalled();
	});

	it("returns search pagination from the canonical read service", async () => {
		mocks.searchApiV1Products.mockResolvedValue({
			products: [{ id: "product-id" }],
			pagination: {
				limit: 15,
				offset: 0,
				total: 20,
				hasMore: true,
				nextOffset: 15,
			},
		});
		const response = await searchFoods({
			locals: createLocals(),
			url: new URL("http://localhost/api/v1/foods/search?q=tomato"),
		} as never);

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			apiVersion: BLENDCALC_API_V1,
			data: [{ id: "product-id" }],
			meta: { pagination: { nextOffset: 15 } },
		});
	});

	it("lists enabled categories with bounded pagination", async () => {
		mocks.readApiV1Categories.mockResolvedValue({
			categories: [{ id: "sauces", name: "Sauces", slug: "sauces" }],
			pagination: {
				limit: 25,
				offset: 0,
				total: 1,
				hasMore: false,
				nextOffset: null,
			},
		});
		const response = await getCategories({
			locals: createLocals(),
			url: new URL("http://localhost/api/v1/categories?limit=25"),
		} as never);

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			data: [{ id: "sauces", name: "Sauces" }],
			meta: { pagination: { limit: 25 } },
		});
	});
});
