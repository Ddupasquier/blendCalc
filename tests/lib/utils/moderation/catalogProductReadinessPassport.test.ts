import { describe, expect, it } from "vitest";
import { parseCatalogProductReadinessPassport } from "$lib/utils/moderation/catalogProductReadinessPassport";
import { catalogProductReadinessPassportFixture } from "../../../fixtures/catalogProductReadinessPassport";

describe("catalog product readiness passport parser", () => {
	it("accepts the bounded product-readiness contract without changing evidence", () => {
		expect(parseCatalogProductReadinessPassport(catalogProductReadinessPassportFixture))
			.toEqual(catalogProductReadinessPassportFixture);
	});

	it("rejects malformed evidence instead of inventing a fallback", () => {
		expect(() => parseCatalogProductReadinessPassport({
			...catalogProductReadinessPassportFixture,
			evidence: {
				...catalogProductReadinessPassportFixture.evidence,
				normalizedNutrientCount: "14",
			},
		})).toThrow(/evidence\.normalizedNutrientCount/u);
	});
});
