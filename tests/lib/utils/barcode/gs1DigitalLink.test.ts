import { describe, expect, it } from "vitest";
import { parseGs1DigitalLink } from "$lib/utils/barcode/gs1DigitalLink";

describe("GS1 Digital Link parsing", () => {
	it("extracts a valid GTIN without making a network request", () => {
		expect(
			parseGs1DigitalLink("https://id.gs1.org/01/09506000151519"),
		).toEqual({
			canonicalValue: "09506000151519",
			productReference: "https://id.gs1.org/01/09506000151519",
		});
	});

	it("supports brand domains and strips package-specific qualifiers", () => {
		expect(
			parseGs1DigitalLink(
				"https://products.example.com/catalog/01/09506000151519/10/LOT-22/21/SERIAL-9?17=271231#details",
			),
		).toEqual({
			canonicalValue: "09506000151519",
			productReference:
				"https://products.example.com/catalog/01/09506000151519",
		});
	});

	it.each([
		"http://id.gs1.org/01/09506000151519",
		"https://user:password@id.gs1.org/01/09506000151519",
		"https://example.com/product/09506000151519",
		"https://id.gs1.org/01/09506000151518",
		"not a URL",
	])("rejects unsafe or invalid input: %s", (value) => {
		expect(parseGs1DigitalLink(value)).toBeNull();
	});
});
