import { describe, expect, it } from "vitest";
import { parseVolumeEquivalent } from "$lib/utils/barcode/servingVolume";

describe("barcode serving volume parsing", () => {
	it.each([
		["2 tbsp (32 g)", { quantity: 2, unit: "tbsp" }],
		["1 1/2 cups (360 g)", { quantity: 1.5, unit: "cup" }],
		["8 fl oz (240 g)", { quantity: 8, unit: "floz" }],
		["250 ml", { quantity: 250, unit: "ml" }],
	])("parses %s", (label, expected) => {
		expect(parseVolumeEquivalent(label)).toEqual(expected);
	});

	it("returns null when no volume is reported", () => {
		expect(parseVolumeEquivalent("1 package (28 g)")).toBeNull();
		expect(parseVolumeEquivalent("16 crisps (28 g)")).toBeNull();
	});
});
