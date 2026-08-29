import { describe, expect, it } from "vitest";
import {
	findLargestBlendCalcAPIPayload,
	summarizeBlendCalcAPIPayload,
} from "../../scripts/lib/catalog/blendCalcAPIPayloadAudit.mjs";

describe("blendCalcAPI payload audit", () => {
	it("reports exact and compressed sizes without hiding empty collections", () => {
		expect(
			summarizeBlendCalcAPIPayload({
				responseBytes: 2048,
				compressedBytes: 512,
				itemCount: 0,
			}),
		).toEqual({
			responseBytes: 2048,
			compressedBytes: 512,
			responseKilobytes: 2,
			compressedKilobytes: 0.5,
			compressionRatio: 0.25,
			itemCount: 0,
			bytesPerItem: 2048,
		});
	});

	it("identifies the largest measured response", () => {
		const small = summarizeBlendCalcAPIPayload({
			responseBytes: 100,
			compressedBytes: 40,
			itemCount: 1,
		});
		const large = summarizeBlendCalcAPIPayload({
			responseBytes: 1000,
			compressedBytes: 300,
			itemCount: 10,
		});

		expect(
			findLargestBlendCalcAPIPayload({ product: small, search: large }),
		).toMatchObject({ scenario: "search", responseBytes: 1000 });
		expect(findLargestBlendCalcAPIPayload({})).toBeNull();
	});

	it.each([
		{ responseBytes: -1, compressedBytes: 0, itemCount: 0 },
		{ responseBytes: 1, compressedBytes: 0.5, itemCount: 0 },
		{ responseBytes: 1, compressedBytes: 1, itemCount: -1 },
	])("rejects invalid measurement %#", (measurement) => {
		expect(() => summarizeBlendCalcAPIPayload(measurement)).toThrow(
			"must be a non-negative whole number",
		);
	});
});
