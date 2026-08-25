import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiV1RequestError } from "$lib/api/v1/request";
import { BLENDCALC_API_V1 } from "$lib/api/v1/types";
import {
	apiV1CategoryFixture,
	apiV1PaginationFixture,
	apiV1ProductFixture,
	apiV1ProductRevisionFixture,
} from "../fixtures/apiV1Catalog";
import { expectApiV1ResponseToMatchOpenApi } from "../lib/api/v1/openApiResponseValidation";

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

const PRODUCT_PATH = "/api/v1/products/{barcode}";
const REVISION_PATH = "/api/v1/products/{barcode}/revisions";
const SEARCH_PATH = "/api/v1/foods/search";
const CATEGORY_PATH = "/api/v1/categories";

const createLocals = (signedIn = true) => ({
	getVerifiedUser: vi
		.fn()
		.mockResolvedValue(signedIn ? { id: "user-id" } : null),
	supabase: { source: "test" },
});

const createPagination = (
	overrides: Partial<typeof apiV1PaginationFixture> = {},
) => ({
	...apiV1PaginationFixture,
	...overrides,
});

describe("blendCalcAPI v1 route responses", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getSupabaseAdminClient.mockReturnValue(mocks.adminClient);
	});

	it.each([
		{
			path: PRODUCT_PATH,
			request: () =>
				getProduct({
					locals: createLocals(false),
					params: { barcode: apiV1ProductFixture.barcode },
				} as never),
		},
		{
			path: REVISION_PATH,
			request: () =>
				getProductRevisions({
					locals: createLocals(false),
					params: { barcode: apiV1ProductFixture.barcode },
					url: new URL(
						`http://localhost/api/v1/products/${apiV1ProductFixture.barcode}/revisions`,
					),
				} as never),
		},
		{
			path: SEARCH_PATH,
			request: () =>
				searchFoods({
					locals: createLocals(false),
					url: new URL("http://localhost/api/v1/foods/search?q=tomato"),
				} as never),
		},
		{
			path: CATEGORY_PATH,
			request: () =>
				getCategories({
					locals: createLocals(false),
					url: new URL("http://localhost/api/v1/categories"),
				} as never),
		},
	])(
		"matches the documented 401 response for $path",
		async ({ path, request }) => {
			const response = await request();
			expect(response.status).toBe(401);
			const payload = await expectApiV1ResponseToMatchOpenApi({
				path,
				response,
			});
			expect(payload).toMatchObject({
				apiVersion: BLENDCALC_API_V1,
				error: { code: "authentication_required" },
			});
			expect(mocks.getSupabaseAdminClient).not.toHaveBeenCalled();
		},
	);

	it("returns a complete approved product matching ProductResponse", async () => {
		mocks.readApiV1ProductByBarcode.mockResolvedValue(apiV1ProductFixture);
		const response = await getProduct({
			locals: createLocals(),
			params: { barcode: apiV1ProductFixture.barcode },
		} as never);

		expect(response.status).toBe(200);
		expect(response.headers.get("x-blendcalc-api-version")).toBe(
			BLENDCALC_API_V1,
		);
		const payload = await expectApiV1ResponseToMatchOpenApi({
			path: PRODUCT_PATH,
			response,
		});
		expect(payload).toEqual({
			apiVersion: BLENDCALC_API_V1,
			data: apiV1ProductFixture,
		});
		expect(mocks.readApiV1ProductByBarcode).toHaveBeenCalledWith(
			mocks.adminClient,
			apiV1ProductFixture.barcode,
		);
	});

	it.each([
		{ barcode: "not-a-barcode", path: PRODUCT_PATH, request: getProduct },
		{ barcode: "123", path: REVISION_PATH, request: getProductRevisions },
	])(
		"matches the documented 400 response for $path",
		async ({ barcode, path, request }) => {
			const response = await request({
				locals: createLocals(),
				params: { barcode },
				url: new URL(`http://localhost/api/v1/products/${barcode}/revisions`),
			} as never);
			expect(response.status).toBe(400);
			const payload = await expectApiV1ResponseToMatchOpenApi({
				path,
				response,
			});
			expect(payload).toMatchObject({ error: { code: "invalid_barcode" } });
		},
	);

	it.each([
		{
			path: SEARCH_PATH,
			request: () =>
				searchFoods({
					locals: createLocals(),
					url: new URL("http://localhost/api/v1/foods/search?q=t"),
				} as never),
			reader: mocks.searchApiV1Products,
		},
		{
			path: CATEGORY_PATH,
			request: () =>
				getCategories({
					locals: createLocals(),
					url: new URL("http://localhost/api/v1/categories?limit=101"),
				} as never),
			reader: mocks.readApiV1Categories,
		},
		{
			path: REVISION_PATH,
			request: () =>
				getProductRevisions({
					locals: createLocals(),
					params: { barcode: apiV1ProductFixture.barcode },
					url: new URL(
						`http://localhost/api/v1/products/${apiV1ProductFixture.barcode}/revisions?limit=101`,
					),
				} as never),
			reader: mocks.readApiV1ProductRevisionHistory,
		},
	])(
		"validates request input against the documented 400 response for $path",
		async ({ path, request, reader }) => {
			const response = await request();
			expect(response.status).toBe(400);
			await expectApiV1ResponseToMatchOpenApi({ path, response });
			expect(reader).not.toHaveBeenCalled();
		},
	);

	it.each([
		{
			path: PRODUCT_PATH,
			reader: mocks.readApiV1ProductByBarcode,
			request: () =>
				getProduct({
					locals: createLocals(),
					params: { barcode: apiV1ProductFixture.barcode },
				} as never),
		},
		{
			path: REVISION_PATH,
			reader: mocks.readApiV1ProductRevisionHistory,
			request: () =>
				getProductRevisions({
					locals: createLocals(),
					params: { barcode: apiV1ProductFixture.barcode },
					url: new URL(
						`http://localhost/api/v1/products/${apiV1ProductFixture.barcode}/revisions`,
					),
				} as never),
		},
	])(
		"matches the documented 404 response for $path",
		async ({ path, reader, request }) => {
			reader.mockResolvedValue(null);
			const response = await request();
			expect(response.status).toBe(404);
			const payload = await expectApiV1ResponseToMatchOpenApi({
				path,
				response,
			});
			expect(payload).toMatchObject({ error: { code: "product_not_found" } });
		},
	);

	it("returns revision history matching ProductRevisionListResponse", async () => {
		mocks.readApiV1ProductRevisionHistory.mockResolvedValue({
			revisions: [apiV1ProductRevisionFixture],
			pagination: createPagination({ limit: 25 }),
		});
		const response = await getProductRevisions({
			locals: createLocals(),
			params: { barcode: apiV1ProductFixture.barcode },
			url: new URL(
				`http://localhost/api/v1/products/${apiV1ProductFixture.barcode}/revisions`,
			),
		} as never);

		expect(response.status).toBe(200);
		const payload = await expectApiV1ResponseToMatchOpenApi({
			path: REVISION_PATH,
			response,
		});
		expect(payload).toMatchObject({
			data: [{ number: 2, changes: [{ field: "ingredients" }] }],
			meta: { pagination: { total: 1 } },
		});
	});

	it("returns search results matching ProductListResponse", async () => {
		mocks.searchApiV1Products.mockResolvedValue({
			products: [apiV1ProductFixture],
			pagination: apiV1PaginationFixture,
		});
		const response = await searchFoods({
			locals: createLocals(),
			url: new URL("http://localhost/api/v1/foods/search?q=tomato"),
		} as never);

		expect(response.status).toBe(200);
		await expectApiV1ResponseToMatchOpenApi({ path: SEARCH_PATH, response });
		expect(mocks.searchApiV1Products).toHaveBeenCalledWith(mocks.adminClient, {
			limit: 15,
			offset: 0,
			query: "tomato",
		});
	});

	it("returns categories matching CategoryListResponse", async () => {
		mocks.readApiV1Categories.mockResolvedValue({
			categories: [apiV1CategoryFixture],
			pagination: createPagination({ limit: 25 }),
		});
		const response = await getCategories({
			locals: createLocals(),
			url: new URL("http://localhost/api/v1/categories?limit=25"),
		} as never);

		expect(response.status).toBe(200);
		await expectApiV1ResponseToMatchOpenApi({ path: CATEGORY_PATH, response });
		expect(mocks.readApiV1Categories).toHaveBeenCalledWith(mocks.adminClient, {
			limit: 25,
			offset: 0,
		});
	});

	it.each([
		{
			path: PRODUCT_PATH,
			reader: mocks.readApiV1ProductByBarcode,
			request: () =>
				getProduct({
					locals: createLocals(),
					params: { barcode: apiV1ProductFixture.barcode },
				} as never),
		},
		{
			path: REVISION_PATH,
			reader: mocks.readApiV1ProductRevisionHistory,
			request: () =>
				getProductRevisions({
					locals: createLocals(),
					params: { barcode: apiV1ProductFixture.barcode },
					url: new URL(
						`http://localhost/api/v1/products/${apiV1ProductFixture.barcode}/revisions`,
					),
				} as never),
		},
		{
			path: SEARCH_PATH,
			reader: mocks.searchApiV1Products,
			request: () =>
				searchFoods({
					locals: createLocals(),
					url: new URL("http://localhost/api/v1/foods/search?q=tomato"),
				} as never),
		},
		{
			path: CATEGORY_PATH,
			reader: mocks.readApiV1Categories,
			request: () =>
				getCategories({
					locals: createLocals(),
					url: new URL("http://localhost/api/v1/categories"),
				} as never),
		},
	])(
		"matches the documented 503 response for $path",
		async ({ path, reader, request }) => {
			reader.mockRejectedValue(new Error("synthetic catalog outage"));
			const consoleError = vi
				.spyOn(console, "error")
				.mockImplementation(() => undefined);
			const response = await request();
			consoleError.mockRestore();
			expect(response.status).toBe(503);
			const payload = await expectApiV1ResponseToMatchOpenApi({
				path,
				response,
			});
			expect(payload).toMatchObject({ error: { code: "catalog_unavailable" } });
		},
	);

	it("does not expose request-like errors thrown by the catalog service", async () => {
		mocks.readApiV1ProductByBarcode.mockRejectedValue(
			new ApiV1RequestError("invalid_request", "private provider detail"),
		);
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		const response = await getProduct({
			locals: createLocals(),
			params: { barcode: apiV1ProductFixture.barcode },
		} as never);
		consoleError.mockRestore();
		expect(response.status).toBe(503);
		const payload = await expectApiV1ResponseToMatchOpenApi({
			path: PRODUCT_PATH,
			response,
		});
		expect(payload).toMatchObject({ error: { code: "catalog_unavailable" } });
		expect(JSON.stringify(payload)).not.toContain("private provider detail");
	});

	it("rejects response fields that are not present in OpenAPI", async () => {
		mocks.readApiV1ProductByBarcode.mockResolvedValue({
			...apiV1ProductFixture,
			privateEvidencePath: "must-not-leak",
		});
		const response = await getProduct({
			locals: createLocals(),
			params: { barcode: apiV1ProductFixture.barcode },
		} as never);
		await expect(
			expectApiV1ResponseToMatchOpenApi({ path: PRODUCT_PATH, response }),
		).rejects.toThrow("Response drift");
	});
});
