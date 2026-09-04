import { afterEach, describe, expect, it, vi } from "vitest";
import { submitSharedProduct } from "$lib/utils/products/catalog";
import type { FoodItem } from "$lib/utils/food/types";

const food: FoodItem = {
	fdcId: -1,
	description: "App Intake Test Product",
	barcode: "00012345678905",
	foodNutrients: [],
};

describe("catalog intake client", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("submits observations through the versioned app-only intake route", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					status: "pending",
					message: "The product is waiting for review.",
				}),
				{
					status: 201,
					headers: { "content-type": "application/json" },
				},
			),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			submitSharedProduct(food, {}, { consentToShare: true }),
		).resolves.toMatchObject({
			status: "pending",
		});
		expect(fetchMock).toHaveBeenCalledOnce();
		const [path, request] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(path).toBe("/api/intake/v1/product-observations");
		expect(request.method).toBe("POST");
		const body = request.body as FormData;
		expect(body.get("consentToShare")).toBe("true");
		expect(body.get("food")).toBe(JSON.stringify(food));
	});

	it("reports real request upload progress when the caller asks for it", async () => {
		const progress = vi.fn();
		class XMLHttpRequestMock {
			status = 201;
			responseText = JSON.stringify({
				status: "pending",
				message: "The product is waiting for review.",
			});
			upload: { onprogress: ((event: ProgressEvent) => void) | null } = {
				onprogress: null,
			};
			onload: (() => void) | null = null;
			onerror: (() => void) | null = null;
			onabort: (() => void) | null = null;
			open = vi.fn();
			setRequestHeader = vi.fn();
			getResponseHeader = vi.fn().mockReturnValue("application/json");
			send = vi.fn(() => {
				this.upload.onprogress?.({
					loaded: 50,
					total: 100,
					lengthComputable: true,
				} as ProgressEvent);
				this.onload?.();
			});
		}
		vi.stubGlobal("XMLHttpRequest", XMLHttpRequestMock);

		await expect(
			submitSharedProduct(
				food,
				{},
				{ consentToShare: true, onProgress: progress },
			),
		).resolves.toMatchObject({ status: "pending" });
		expect(progress).toHaveBeenCalledWith({
			phase: "uploading",
			loaded: 50,
			total: 100,
		});
		expect(progress).toHaveBeenLastCalledWith({ phase: "uploaded" });
	});
});
