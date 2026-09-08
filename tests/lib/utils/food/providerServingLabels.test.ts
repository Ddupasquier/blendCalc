import { describe, expect, it } from "vitest";
import {
	canonicalizeExternalProviderServingLabel,
	canonicalizeProviderServingLabel,
} from "$lib/utils/food/servings/providerServingLabels";

describe("provider serving labels", () => {
	it.each([
		["1 ONZ", "1 oz"],
		["14.5 onzas", "14.5 oz"],
		["1 ONZA (28 g)", "1 oz (28 g)"],
		["2 cucharadas", "2 tbsp"],
		["250 mililitros", "250 mL"],
		["1 onza fluida", "1 fl oz"],
	])("canonicalizes reviewed source units in %s", (input, expected) => {
		expect(canonicalizeProviderServingLabel(input)).toBe(expected);
	});

	it.each(["1 oz", "1 bronze scoop", "one porción", "small package"])(
		"leaves unrelated or unsupported label text unchanged: %s",
		(input) => {
			expect(canonicalizeProviderServingLabel(input)).toBe(input);
		},
	);

	it("does not rewrite user-authored serving labels", () => {
		expect(
			canonicalizeExternalProviderServingLabel("1 ONZ", "user-label"),
		).toBe("1 ONZ");
	});
});
