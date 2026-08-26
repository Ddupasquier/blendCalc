import { beforeEach, describe, expect, it, vi } from "vitest";
import { BlendCalcAPIV1RequestError } from "$lib/blendCalcAPI/v1/blendCalcAPIRequest";
import { BLENDCALC_API_V1 } from "$lib/blendCalcAPI/v1/blendCalcAPITypes";
import {
	blendCalcAPIV1CategoryFixture,
	blendCalcAPIV1PaginationFixture,
	blendCalcAPIV1ProductFixture,
	blendCalcAPIV1ProductRevisionFixture,
} from "../fixtures/blendCalcAPIV1Catalog";
import { expectBlendCalcAPIV1ResponseToMatchOpenAPI } from "../lib/blendCalcAPI/v1/openAPIResponseValidation";

const mocks = vi.hoisted(() => ({
	adminClient: { source: "trusted-server" },
	getSupabaseAdminClient: vi.fn(),
	readBlendCalcAPIV1Categories: vi.fn(),
	readBlendCalcAPIV1ProductByBarcode: vi.fn(),
	readBlendCalcAPIV1ProductRevisionHistory: vi.fn(),
	searchBlendCalcAPIV1Products: vi.fn(),
}));

vi.mock("$lib/supabase/admin.server", () => ({
	getSupabaseAdminClient: mocks.getSupabaseAdminClient,
}));

vi.mock("$lib/server/blendCalcAPI/v1/blendCalcAPICatalog.server", () => ({
	readBlendCalcAPIV1Categories: mocks.readBlendCalcAPIV1Categories,
	readBlendCalcAPIV1ProductByBarcode: mocks.readBlendCalcAPIV1ProductByBarcode,
	readBlendCalcAPIV1ProductRevisionHistory:
		mocks.readBlendCalcAPIV1ProductRevisionHistory,
	searchBlendCalcAPIV1Products: mocks.searchBlendCalcAPIV1Products,
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
	overrides: Partial<typeof blendCalcAPIV1PaginationFixture> = {},
) => ({
	...blendCalcAPIV1PaginationFixture,
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
					params: { barcode: blendCalcAPIV1ProductFixture.barcode },
				} as never),
		},
		{
			path: REVISION_PATH,
			request: () =>
				getProductRevisions({
					locals: createLocals(false),
					params: { barcode: blendCalcAPIV1ProductFixture.barcode },
					url: new URL(
						`http://localhost/api/v1/products/${blendCalcAPIV1ProductFixture.barcode}/revisions`,
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
			const payload = await expectBlendCalcAPIV1ResponseToMatchOpenAPI({
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
		mocks.readBlendCalcAPIV1ProductByBarcode.mockResolvedValue(
			blendCalcAPIV1ProductFixture,
		);
		const response = await getProduct({
			locals: createLocals(),
			params: { barcode: blendCalcAPIV1ProductFixture.barcode },
		} as never);

		expect(response.status).toBe(200);
		expect(response.headers.get("x-blendcalc-api-version")).toBe(
			BLENDCALC_API_V1,
		);
		const payload = await expectBlendCalcAPIV1ResponseToMatchOpenAPI({
			path: PRODUCT_PATH,
			response,
		});
		expect(payload).toEqual({
			apiVersion: BLENDCALC_API_V1,
			data: blendCalcAPIV1ProductFixture,
		});
		expect(mocks.readBlendCalcAPIV1ProductByBarcode).toHaveBeenCalledWith(
			mocks.adminClient,
			blendCalcAPIV1ProductFixture.barcode,
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
			const payload = await expectBlendCalcAPIV1ResponseToMatchOpenAPI({
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
			reader: mocks.searchBlendCalcAPIV1Products,
		},
		{
			path: CATEGORY_PATH,
			request: () =>
				getCategories({
					locals: createLocals(),
					url: new URL("http://localhost/api/v1/categories?limit=101"),
				} as never),
			reader: mocks.readBlendCalcAPIV1Categories,
		},
		{
			path: REVISION_PATH,
			request: () =>
				getProductRevisions({
					locals: createLocals(),
					params: { barcode: blendCalcAPIV1ProductFixture.barcode },
					url: new URL(
						`http://localhost/api/v1/products/${blendCalcAPIV1ProductFixture.barcode}/revisions?limit=101`,
					),
				} as never),
			reader: mocks.readBlendCalcAPIV1ProductRevisionHistory,
		},
	])(
		"validates request input against the documented 400 response for $path",
		async ({ path, request, reader }) => {
			const response = await request();
			expect(response.status).toBe(400);
			await expectBlendCalcAPIV1ResponseToMatchOpenAPI({ path, response });
			expect(reader).not.toHaveBeenCalled();
		},
	);

	it.each([
		{
			path: PRODUCT_PATH,
			reader: mocks.readBlendCalcAPIV1ProductByBarcode,
			request: () =>
				getProduct({
					locals: createLocals(),
					params: { barcode: blendCalcAPIV1ProductFixture.barcode },
				} as never),
		},
		{
			path: REVISION_PATH,
			reader: mocks.readBlendCalcAPIV1ProductRevisionHistory,
			request: () =>
				getProductRevisions({
					locals: createLocals(),
					params: { barcode: blendCalcAPIV1ProductFixture.barcode },
					url: new URL(
						`http://localhost/api/v1/products/${blendCalcAPIV1ProductFixture.barcode}/revisions`,
					),
				} as never),
		},
	])(
		"matches the documented 404 response for $path",
		async ({ path, reader, request }) => {
			reader.mockResolvedValue(null);
			const response = await request();
			expect(response.status).toBe(404);
			const payload = await expectBlendCalcAPIV1ResponseToMatchOpenAPI({
				path,
				response,
			});
			expect(payload).toMatchObject({ error: { code: "product_not_found" } });
		},
	);

	it("returns revision history matching ProductRevisionListResponse", async () => {
		mocks.readBlendCalcAPIV1ProductRevisionHistory.mockResolvedValue({
			revisions: [blendCalcAPIV1ProductRevisionFixture],
			pagination: createPagination({ limit: 25 }),
		});
		const response = await getProductRevisions({
			locals: createLocals(),
			params: { barcode: blendCalcAPIV1ProductFixture.barcode },
			url: new URL(
				`http://localhost/api/v1/products/${blendCalcAPIV1ProductFixture.barcode}/revisions`,
			),
		} as never);

		expect(response.status).toBe(200);
		const payload = await expectBlendCalcAPIV1ResponseToMatchOpenAPI({
			path: REVISION_PATH,
			response,
		});
		expect(payload).toMatchObject({
			data: [{ number: 2, changes: [{ field: "ingredients" }] }],
			meta: { pagination: { total: 1 } },
		});
	});

	it("returns search results matching ProductListResponse", async () => {
		mocks.searchBlendCalcAPIV1Products.mockResolvedValue({
			products: [blendCalcAPIV1ProductFixture],
			pagination: blendCalcAPIV1PaginationFixture,
		});
		const response = await searchFoods({
			locals: createLocals(),
			url: new URL("http://localhost/api/v1/foods/search?q=tomato"),
		} as never);

		expect(response.status).toBe(200);
		await expectBlendCalcAPIV1ResponseToMatchOpenAPI({
			path: SEARCH_PATH,
			response,
		});
		expect(mocks.searchBlendCalcAPIV1Products).toHaveBeenCalledWith(
			mocks.adminClient,
			{
				limit: 15,
				offset: 0,
				query: "tomato",
			},
		);
	});

	it("returns categories matching CategoryListResponse", async () => {
		mocks.readBlendCalcAPIV1Categories.mockResolvedValue({
			categories: [blendCalcAPIV1CategoryFixture],
			pagination: createPagination({ limit: 25 }),
		});
		const response = await getCategories({
			locals: createLocals(),
			url: new URL("http://localhost/api/v1/categories?limit=25"),
		} as never);

		expect(response.status).toBe(200);
		await expectBlendCalcAPIV1ResponseToMatchOpenAPI({
			path: CATEGORY_PATH,
			response,
		});
		expect(mocks.readBlendCalcAPIV1Categories).toHaveBeenCalledWith(
			mocks.adminClient,
			{
				limit: 25,
				offset: 0,
			},
		);
	});

	it.each([
		{
			path: PRODUCT_PATH,
			reader: mocks.readBlendCalcAPIV1ProductByBarcode,
			request: () =>
				getProduct({
					locals: createLocals(),
					params: { barcode: blendCalcAPIV1ProductFixture.barcode },
				} as never),
		},
		{
			path: REVISION_PATH,
			reader: mocks.readBlendCalcAPIV1ProductRevisionHistory,
			request: () =>
				getProductRevisions({
					locals: createLocals(),
					params: { barcode: blendCalcAPIV1ProductFixture.barcode },
					url: new URL(
						`http://localhost/api/v1/products/${blendCalcAPIV1ProductFixture.barcode}/revisions`,
					),
				} as never),
		},
		{
			path: SEARCH_PATH,
			reader: mocks.searchBlendCalcAPIV1Products,
			request: () =>
				searchFoods({
					locals: createLocals(),
					url: new URL("http://localhost/api/v1/foods/search?q=tomato"),
				} as never),
		},
		{
			path: CATEGORY_PATH,
			reader: mocks.readBlendCalcAPIV1Categories,
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
			const payload = await expectBlendCalcAPIV1ResponseToMatchOpenAPI({
				path,
				response,
			});
			expect(payload).toMatchObject({ error: { code: "catalog_unavailable" } });
		},
	);

	it("does not expose request-like errors thrown by the catalog service", async () => {
		mocks.readBlendCalcAPIV1ProductByBarcode.mockRejectedValue(
			new BlendCalcAPIV1RequestError(
				"invalid_request",
				"private provider detail",
			),
		);
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		const response = await getProduct({
			locals: createLocals(),
			params: { barcode: blendCalcAPIV1ProductFixture.barcode },
		} as never);
		consoleError.mockRestore();
		expect(response.status).toBe(503);
		const payload = await expectBlendCalcAPIV1ResponseToMatchOpenAPI({
			path: PRODUCT_PATH,
			response,
		});
		expect(payload).toMatchObject({ error: { code: "catalog_unavailable" } });
		expect(JSON.stringify(payload)).not.toContain("private provider detail");
	});

	it("rejects response fields that are not present in OpenAPI", async () => {
		mocks.readBlendCalcAPIV1ProductByBarcode.mockResolvedValue({
			...blendCalcAPIV1ProductFixture,
			privateEvidencePath: "must-not-leak",
		});
		const response = await getProduct({
			locals: createLocals(),
			params: { barcode: blendCalcAPIV1ProductFixture.barcode },
		} as never);
		await expect(
			expectBlendCalcAPIV1ResponseToMatchOpenAPI({
				path: PRODUCT_PATH,
				response,
			}),
		).rejects.toThrow("Response drift");
	});
});
