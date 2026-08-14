import { beforeEach, describe, expect, it, vi } from "vitest";
import { lookupColaCloudBarcodeProduct } from "$lib/server/products/sources/colaCloudBarcodeProduct.server";
import type { ProductReferenceCatalog } from "$lib/utils/food/reference/productReferenceCatalog";

vi.mock("$lib/server/products/sourceMetrics.server", () => ({
	createProductSourceRequestTrace: () => ({
		apiRequestCount: 0,
		apiErrorCount: 0,
		cacheHitCount: 0,
	}),
	recordProductSourceApiRequest: (trace?: { apiRequestCount: number }) => {
		if (trace) trace.apiRequestCount += 1;
	},
	recordProductSourceApiError: (trace?: { apiErrorCount: number }) => {
		if (trace) trace.apiErrorCount += 1;
	},
	recordProductSourceCacheHit: (trace?: { cacheHitCount: number }) => {
		if (trace) trace.cacheHitCount += 1;
	},
	recordProductSourceLookup: vi.fn(),
}));

const productReferenceCatalog: ProductReferenceCatalog = {
	sources: {
		"cola-cloud": {
			key: "cola-cloud",
			displayName: "COLA Cloud",
			attributionText: "Alcohol label data from TTB records through COLA Cloud.",
			canonicalStorageAllowed: false,
			canonicalLicenseName: null,
		},
	},
	nutrientMappings: [],
	nutrientConversions: [],
	nutrientEquivalences: [],
};

const barcode = "649754706570";
const canonicalBarcode = "00649754706570";
const approvalId = "26188001000045";

const jsonResponse = (data: unknown, status = 200) => new Response(
	JSON.stringify(data),
	{
		status,
		headers: { "content-type": "application/json" },
	},
);

const makeFetch = (detailOverrides: Record<string, unknown> = {}) =>
	vi.fn<typeof fetch>(async (input, init) => {
		expect(new Headers(init?.headers).get("x-api-key")).toBe("test-key");
		const url = String(input);
		if (url.endsWith(`/barcode/${barcode}`)) {
			return jsonResponse({
				data: {
					barcode_value: barcode,
					total_colas: 2,
					colas: [
						{
							ttb_id: "19001000000001",
							application_status: "approved",
							approval_date: "2019-01-01",
						},
						{
							ttb_id: approvalId,
							application_status: "approved",
							approval_date: "2026-07-13",
						},
					],
				},
			});
		}
		if (url.endsWith(`/colas/${approvalId}`)) {
			return jsonResponse({
				data: {
					ttb_id: approvalId,
					application_status: "approved",
					approval_date: "2026-07-13",
					latest_update_date: "2026-07-14",
					brand_name: "Trillium",
					product_name: "Hard Lemonade",
					product_type: "distilled spirits",
					abv: 6.5,
					volume: 12,
					volume_unit: "fluid ounces",
					barcodes: [{ barcode_value: barcode }],
					...detailOverrides,
				},
			});
		}
		return jsonResponse(null, 404);
	});

describe("COLA Cloud exact-barcode lookup", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("does not call the provider when the server key is unavailable", async () => {
		const fetcher = makeFetch();

		const result = await lookupColaCloudBarcodeProduct(
			barcode,
			productReferenceCatalog,
			{ apiKey: "", fetcher },
		);

		expect(result).toBeNull();
		expect(fetcher).not.toHaveBeenCalled();
	});

	it("selects the newest approved label and maps only explicit product evidence", async () => {
		const fetcher = makeFetch();

		const result = await lookupColaCloudBarcodeProduct(
			barcode,
			productReferenceCatalog,
			{ apiKey: "test-key", fetcher },
		);

		expect(fetcher).toHaveBeenCalledTimes(2);
		expect(result).toMatchObject({
			barcode: canonicalBarcode,
			name: "Hard Lemonade",
			brandOwner: "Trillium",
			hasSourceServing: false,
			nutrients: [],
			reportedNutrientIds: [],
			packageQuantity: {
				label: "12 fluid ounces",
				amount: 12,
				unit: "fluid ounces",
			},
			alcoholByVolume: {
				percent: 6.5,
				valueStatus: "reported",
				basis: "volume-percent",
				sourceUnit: "% ABV",
			},
			regulatoryDisclosure: {
				profileKey: "us-ttb-alcohol-beverage-v1",
				evidenceStatus: "source-reported",
			},
			source: "cola-cloud",
			sourceLabel: "COLA Cloud",
			sourceReference: approvalId,
			sourceDataType: "distilled spirits",
			fieldProvenance: {
				productName: { source: "cola-cloud", sourceReference: approvalId },
				brandOwner: { source: "cola-cloud", sourceReference: approvalId },
				package: { source: "cola-cloud", sourceReference: approvalId },
				alcoholByVolume: { source: "cola-cloud", sourceReference: approvalId },
				regulatoryDisclosure: {
					source: "cola-cloud",
					sourceReference: approvalId,
				},
			},
		});
		expect(result).not.toHaveProperty("image");
		expect(result).not.toHaveProperty("categories");
		expect(result).not.toHaveProperty("ingredients");
	});

	it("preserves a source-reported zero without inventing nutrition", async () => {
		const result = await lookupColaCloudBarcodeProduct(
			barcode,
			productReferenceCatalog,
			{ apiKey: "test-key", fetcher: makeFetch({ abv: 0 }) },
		);

		expect(result?.alcoholByVolume).toMatchObject({
			percent: 0,
			valueStatus: "reported-zero",
		});
		expect(result?.nutrients).toEqual([]);
	});

	it("omits invalid ABV rather than coercing it to zero", async () => {
		const result = await lookupColaCloudBarcodeProduct(
			barcode,
			productReferenceCatalog,
			{ apiKey: "test-key", fetcher: makeFetch({ abv: 101 }) },
		);

		expect(result?.alcoholByVolume).toBeUndefined();
		expect(result?.fieldProvenance?.alcoholByVolume).toBeUndefined();
	});

	it("rejects a detail record that does not repeat the exact GTIN", async () => {
		const result = await lookupColaCloudBarcodeProduct(
			barcode,
			productReferenceCatalog,
			{
				apiKey: "test-key",
				fetcher: makeFetch({
					barcode_value: "012345678905",
					barcodes: [{ barcode_value: "012345678905" }],
				}),
			},
		);

		expect(result).toBeNull();
	});

	it("tries equivalent GTIN candidates sequentially and stops after a match", async () => {
		const requestedUrls: string[] = [];
		const fetcher = vi.fn<typeof fetch>(async (input) => {
			const url = String(input);
			requestedUrls.push(url);
			if (url.endsWith(`/barcode/${barcode}`)) return jsonResponse(null, 404);
			if (url.endsWith(`/barcode/${canonicalBarcode}`)) {
				return jsonResponse({
					data: {
						barcode_value: barcode,
						colas: [{
							ttb_id: approvalId,
							application_status: "approved",
							approval_date: "2026-07-13",
						}],
					},
				});
			}
			return jsonResponse({
				data: {
					ttb_id: approvalId,
					application_status: "approved",
					product_name: "Hard Lemonade",
					barcodes: [{ barcode_value: barcode }],
				},
			});
		});

		const result = await lookupColaCloudBarcodeProduct(
			canonicalBarcode,
			productReferenceCatalog,
			{ apiKey: "test-key", fetcher },
		);

		expect(result?.sourceReference).toBe(approvalId);
		expect(requestedUrls).toEqual([
			`https://app.colacloud.us/api/v1/barcode/${barcode}`,
			"https://app.colacloud.us/api/v1/barcode/0649754706570",
			`https://app.colacloud.us/api/v1/barcode/${canonicalBarcode}`,
			`https://app.colacloud.us/api/v1/colas/${approvalId}`,
		]);
	});
});
