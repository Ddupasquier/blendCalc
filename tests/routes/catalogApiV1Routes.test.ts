import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	adminClient: { source: "trusted-server" },
	getSupabaseAdminClient: vi.fn(),
	readApiV1Categories: vi.fn(),
	readApiV1ProductByBarcode: vi.fn(),
	readApiV1ProductRevisionHistory: vi.fn(),
	searchApiV1Products: vi.fn(),
}));

vi.mock("$lib/supabase/admin.server", () => ({
	getSupabaseAdminClient: mocks.getSupabaseAdminClient,
}));

vi.mock("$lib/server/api/v1/catalogApi.server", () => ({
	readApiV1Categories: mocks.readApiV1Categories,
	readApiV1ProductByBarcode: mocks.readApiV1ProductByBarcode,
	readApiV1ProductRevisionHistory: mocks.readApiV1ProductRevisionHistory,
	searchApiV1Products: mocks.searchApiV1Products,
}));

import { GET as getCategories } from "../../src/routes/api/v1/categories/+server";
import { GET as searchFoods } from "../../src/routes/api/v1/foods/search/+server";
import { GET as getProduct } from "../../src/routes/api/v1/products/[barcode]/+server";
import { GET as getProductRevisions } from "../../src/routes/api/v1/products/[barcode]/revisions/+server";
import { BLENDCALC_API_V1 } from "$lib/api/v1/types";

const createLocals = (signedIn = true) => ({
	getVerifiedUser: vi.fn().mockResolvedValue(signedIn ? { id: "user-id" } : null),
	supabase: { source: "test" },
});

describe("blendCalc API v1 routes", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getSupabaseAdminClient.mockReturnValue(mocks.adminClient);
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
		expect(mocks.getSupabaseAdminClient).not.toHaveBeenCalled();
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
			mocks.adminClient,
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

	it("returns revision history through a separate paginated contract", async () => {
		mocks.readApiV1ProductRevisionHistory.mockResolvedValue({
			revisions: [{
				id: "revision-id",
				number: 2,
				publishedAt: "2026-07-29T12:00:00.000Z",
				labelObservedAt: "2026-07-28T12:00:00.000Z",
				changes: [{
					field: "ingredients",
					label: "Ingredient statement",
					changeType: "changed",
					previousValue: "Old ingredients",
					newValue: "New ingredients",
					severity: "medium",
				}],
			}],
			pagination: {
				limit: 25,
				offset: 0,
				total: 2,
				hasMore: true,
				nextOffset: 25,
			},
		});
		const locals = createLocals();
		const response = await getProductRevisions({
			locals,
			params: { barcode: "00021130493609" },
			url: new URL(
				"http://localhost/api/v1/products/00021130493609/revisions",
			),
		} as never);

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			data: [{
				number: 2,
				changes: [{ field: "ingredients" }],
			}],
			meta: { pagination: { total: 2 } },
		});
		expect(mocks.readApiV1ProductRevisionHistory).toHaveBeenCalledWith(
			mocks.adminClient,
			"00021130493609",
			{ limit: 25, offset: 0 },
		);
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
		expect(mocks.searchApiV1Products).toHaveBeenCalledWith(
			mocks.adminClient,
			{ limit: 15, offset: 0, query: "tomato" },
		);
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
		expect(mocks.readApiV1Categories).toHaveBeenCalledWith(
			mocks.adminClient,
			{ limit: 25, offset: 0 },
		);
	});
});
