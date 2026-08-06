import { describe, expect, it } from "vitest";
import { formatMixQuantity } from "$lib/utils/mix/formatting/mixQuantity";

describe("Mix quantity formatting", () => {
	it("uses one honest precision policy for zero, trace, fractional, and large values", () => {
		expect(formatMixQuantity(0, { unit: "g" })).toBe("0 g");
		expect(formatMixQuantity(0.0004, { unit: "g" })).toBe("<0.001 g");
		expect(formatMixQuantity(0.004, { unit: "g" })).toBe("0.004 g");
		expect(formatMixQuantity(0.01, { unit: "g" })).toBe("0.01 g");
		expect(formatMixQuantity(8.25, { unit: "g" })).toBe("8.25 g");
		expect(formatMixQuantity(25.4, { unit: "g" })).toBe("25.4 g");
		expect(formatMixQuantity(1250, { unit: "mg" })).toBe("1,250 mg");
	});

	it("handles signs, percentages, missing units, and invalid values consistently", () => {
		expect(formatMixQuantity(1.25, { unit: "g", sign: "always" })).toBe(
			"+1.25 g",
		);
		expect(formatMixQuantity(-0.0004, { unit: "g" })).toBe("−<0.001 g");
		expect(formatMixQuantity(33.3333, { unit: "%" })).toBe("33.333%");
		expect(formatMixQuantity(12.5)).toBe("12.5");
		expect(formatMixQuantity(Number.NaN, { unit: "g" })).toBe("—");
	});
});
