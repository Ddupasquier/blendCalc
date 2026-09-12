import { describe, expect, it } from "vitest";

import {
	getCatalogCorrectionEvidenceRoles,
	parseCatalogCorrectionEvidenceRoles,
} from "$lib/utils/products/productEvidenceRequirements";

describe("catalog correction evidence requirements", () => {
	it("requests only the evidence roles for the changed field families", () => {
		expect(
			getCatalogCorrectionEvidenceRoles([
				"nutrient:203",
				"servingWeightGrams",
				"productName",
			]),
		).toEqual(["nutrition", "front"]);
	});

	it("falls back to every evidence role when the changed fields are unknown", () => {
		expect(getCatalogCorrectionEvidenceRoles([])).toEqual([
			"front",
			"nutrition",
			"barcode",
		]);
		expect(getCatalogCorrectionEvidenceRoles(["unexpectedField"])).toEqual([
			"front",
			"nutrition",
			"barcode",
		]);
	});

	it("accepts only known roles from a correction URL", () => {
		expect(
			parseCatalogCorrectionEvidenceRoles("nutrition,front,anything"),
		).toEqual(["front", "nutrition"]);
		expect(parseCatalogCorrectionEvidenceRoles(null)).toBeUndefined();
		expect(parseCatalogCorrectionEvidenceRoles("none")).toEqual([]);
		expect(parseCatalogCorrectionEvidenceRoles("anything")).toBeUndefined();
	});
});
