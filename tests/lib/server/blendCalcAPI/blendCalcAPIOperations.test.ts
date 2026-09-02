import { describe, expect, it } from "vitest";
import {
	observeBlendCalcAPIDatabaseRead,
	readBlendCalcAPIOperation,
} from "$lib/server/blendCalcAPI/operations/blendCalcAPIOperations.server";

describe("blendCalcAPI operational observations", () => {
	it.each([
		["/api/v1/categories", "categories"],
		["/api/v1/foods/search", "search"],
		["/api/v1/products/00000000000000", "product"],
		["/api/v1/products/00000000000000/revisions", "revisions"],
		["/api/v1/unsupported", "unknown"],
	])(
		"classifies %s without retaining request identifiers",
		(pathname, operation) => {
			expect(readBlendCalcAPIOperation(pathname)).toBe(operation);
		},
	);

	it("records database duration and bounded result count on locals", async () => {
		const locals = {} as App.Locals;
		const result = await observeBlendCalcAPIDatabaseRead(
			locals,
			async () => ({ products: ["one", "two"] }),
			(value) => value.products.length,
		);
		expect(result.products).toHaveLength(2);
		expect(locals.blendCalcAPIDatabaseObservation).toMatchObject({
			resultCount: 2,
		});
		expect(
			locals.blendCalcAPIDatabaseObservation?.databaseDurationMs,
		).toBeGreaterThanOrEqual(0);
	});

	it("retains database timing when the read fails", async () => {
		const locals = {} as App.Locals;
		await expect(
			observeBlendCalcAPIDatabaseRead(
				locals,
				async () => {
					throw new Error("database unavailable");
				},
				() => 1,
			),
		).rejects.toThrow("database unavailable");
		expect(locals.blendCalcAPIDatabaseObservation).toMatchObject({
			resultCount: 0,
		});
	});
});
