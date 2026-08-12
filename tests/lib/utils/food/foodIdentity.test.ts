import { describe, expect, it } from "vitest";
import { resolveFoodIdentityType } from "$lib/utils/food/identity/foodIdentity";

describe("food identity resolution", () => {
	it("preserves identity assigned by a source adapter", () => {
		expect(resolveFoodIdentityType({
			foodIdentityType: "generic",
			dataType: "Future source type",
		})).toBe("generic");
	});

	it("recognizes concrete package and private-entry evidence", () => {
		expect(resolveFoodIdentityType({
			barcode: "00021130462506",
		})).toBe("packaged");
		expect(resolveFoodIdentityType({
			brandOwner: "Example Brand",
		})).toBe("packaged");
		expect(resolveFoodIdentityType({
			customFood: true,
		})).toBe("private-custom");
	});

	it("does not interpret provider datatype vocabulary outside its adapter", () => {
		expect(resolveFoodIdentityType({
			dataType: "Foundation",
		})).toBe("unknown");
		expect(resolveFoodIdentityType({
			dataType: "Future source type",
		})).toBe("unknown");
	});
});
