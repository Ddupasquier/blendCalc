import { describe, expect, it } from "vitest";
import {
	getReviewedUcumConversion,
	UCUM_STANDARD_REFERENCE,
} from "../../scripts/lib/reference-data/reviewedUnitConversions.mjs";

describe("reviewed UCUM conversions", () => {
	it.each([
		["10*-3.g", "g", 0.001],
		["g", "10*-6.g", 1000000],
		["kJ", "kcal", 0.23900574],
		["[cup_us]", "mL", 236.58824],
	])("returns the reviewed %s to %s multiplier", (fromCode, toCode, value) => {
		expect(getReviewedUcumConversion({ fromCode, toCode })).toMatchObject({
			value,
			sourceReference: UCUM_STANDARD_REFERENCE.specificationUrl,
		});
	});

	it("does not invent an unreviewed conversion", () => {
		expect(getReviewedUcumConversion({
			fromCode: "[cup_us]",
			toCode: "g",
		})).toBeNull();
	});
});
