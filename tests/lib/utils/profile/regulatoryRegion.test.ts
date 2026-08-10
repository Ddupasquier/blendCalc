import { describe, expect, it } from "vitest";
import {
	getDeviceRegulatoryRegionSuggestion,
	normalizeRegulatoryRegionCode,
	normalizeRegulatoryRegionSource,
} from "$lib/utils/profile/regulatoryRegion";

const options = [
	{ regionCode: "US", displayName: "United States", authority: "FDA" },
	{ regionCode: "GB", displayName: "United Kingdom", authority: "FSA" },
	{ regionCode: "AU-NZ", displayName: "Australia and New Zealand", authority: "FSANZ" },
];

describe("regulatory region preferences", () => {
	it("normalizes bounded form values", () => {
		expect(normalizeRegulatoryRegionCode(" gb ")).toBe("GB");
		expect(normalizeRegulatoryRegionSource("device")).toBe("device");
		expect(normalizeRegulatoryRegionSource("browser")).toBeNull();
	});

	it("suggests only a region represented by DB-provided options", () => {
		expect(getDeviceRegulatoryRegionSuggestion(["en-GB"], options)).toBe("GB");
		expect(getDeviceRegulatoryRegionSuggestion(["en-NZ"], options)).toBe("AU-NZ");
		expect(getDeviceRegulatoryRegionSuggestion(["fr-FR"], options)).toBe("");
	});

	it("does not infer a region from a language without an explicit region", () => {
		expect(getDeviceRegulatoryRegionSuggestion(["en"], options)).toBe("");
	});
});
