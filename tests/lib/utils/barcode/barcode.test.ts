import { describe, expect, it } from "vitest";
import {
	cleanBarcode,
	getBarcodeInputValidationMessage,
	getBarcodeLookupCandidates,
	hasValidGtinCheckDigit,
	normalizeBarcode,
} from "$lib/utils/barcode/barcode";

describe("barcode normalization", () => {
	it("keeps only barcode digits", () => {
		expect(cleanBarcode("4006 3813-3393 1")).toBe("4006381333931");
	});

	it("validates UPC and EAN check digits", () => {
		expect(hasValidGtinCheckDigit("012345678905")).toBe(true);
		expect(hasValidGtinCheckDigit("4006381333931")).toBe(true);
		expect(hasValidGtinCheckDigit("4006381333932")).toBe(false);
	});

	it("stores equivalent codes as a canonical GTIN-14", () => {
		expect(normalizeBarcode("4006381333931")).toBe("04006381333931");
		expect(getBarcodeLookupCandidates("4006381333931")).toEqual(
			expect.arrayContaining(["4006381333931", "04006381333931"]),
		);
	});

	it("tries the normal package barcode before padded equivalents", () => {
		expect(getBarcodeLookupCandidates("00021130493609")).toEqual([
			"021130493609",
			"0021130493609",
			"00021130493609",
		]);
	});

	it("explains incomplete and invalid manually typed barcodes", () => {
		expect(getBarcodeInputValidationMessage("12345")).toMatch(
			/barcode is incomplete/i,
		);
		expect(getBarcodeInputValidationMessage("123456789012345")).toMatch(
			/barcode is too long/i,
		);
		expect(getBarcodeInputValidationMessage("4006381333932")).toMatch(
			/check digit/i,
		);
		expect(getBarcodeInputValidationMessage("4006381333931")).toBe("");
	});
});
