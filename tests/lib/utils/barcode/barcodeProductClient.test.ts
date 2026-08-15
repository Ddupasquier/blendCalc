import { afterEach, describe, expect, it, vi } from "vitest";
import { lookupBarcodeProduct } from "$lib/utils/barcode/barcodeProductClient";

describe("lookupBarcodeProduct", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("shares one pending browser request for the same barcode", async () => {
		let resolveFetch!: (response: Response) => void;
		const fetcher = vi.fn(() => new Promise<Response>((resolve) => {
			resolveFetch = resolve;
		}));
		vi.stubGlobal("fetch", fetcher);

		const firstLookup = lookupBarcodeProduct("00021130493609");
		const secondLookup = lookupBarcodeProduct("00021130493609");
		expect(fetcher).toHaveBeenCalledTimes(1);

		resolveFetch(new Response(JSON.stringify({
			status: "found",
			draft: { name: "Strawberry Jelly" },
		}), {
			status: 200,
			headers: { "content-type": "application/json" },
		}));

		await expect(Promise.all([firstLookup, secondLookup])).resolves.toEqual([
			{ status: "found", draft: { name: "Strawberry Jelly" } },
			{ status: "found", draft: { name: "Strawberry Jelly" } },
		]);
	});

	it("removes a completed lookup so a later request can refresh", async () => {
		const fetcher = vi.fn().mockResolvedValue(
			new Response(null, { status: 404 }),
		);
		vi.stubGlobal("fetch", fetcher);

		await lookupBarcodeProduct("00021130493609");
		await lookupBarcodeProduct("00021130493609");

		expect(fetcher).toHaveBeenCalledTimes(2);
	});

	it("rejects invalid barcode input without a network request", async () => {
		const fetcher = vi.fn();
		vi.stubGlobal("fetch", fetcher);

		await expect(lookupBarcodeProduct("not-a-barcode")).resolves.toMatchObject({
			status: "error",
		});
		expect(fetcher).not.toHaveBeenCalled();
	});
});
