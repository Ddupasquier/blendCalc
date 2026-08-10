import { describe, expect, it } from "vitest";
import {
	formatSourceProductName,
	isAllCapsProductName,
	isManagedProductName,
	normalizeFoodProductName,
} from "$lib/utils/products/productNameFormatting.js";

describe("source product name formatting", () => {
	it("converts API names to readable title-style capitalization", () => {
		expect(formatSourceProductName("I DON'T WANT TO SEE FULL CAPS.")).toBe(
			"I Don't Want To See Full Caps.",
		);
		expect(formatSourceProductName("Tomato, roma")).toBe("Tomato, Roma");
		expect(formatSourceProductName("peanut butter, smooth style")).toBe(
			"Peanut Butter, Smooth Style",
		);
		expect(formatSourceProductName("MACARONI AND CHEESE")).toBe(
			"Macaroni & Cheese",
		);
	});

	it("preserves approved acronyms and intentional mixed capitalization", () => {
		expect(formatSourceProductName("USDA BBQ SAUCE")).toBe("USDA BBQ Sauce");
		expect(formatSourceProductName("[QA] QUESTIONABLE CHIPS")).toBe(
			"[QA] Questionable Chips",
		);
		expect(formatSourceProductName("M&M'S CANDY")).toBe("M&M's Candy");
		expect(formatSourceProductName("O'BRIEN'S 32 FL OZ SAUCE")).toBe(
			"O'Brien's 32 fl oz Sauce",
		);
		expect(formatSourceProductName("McDonald's iPhone Snack")).toBe(
			"McDonald's iPhone Snack",
		);
	});

	it("collapses accidental source whitespace", () => {
		expect(formatSourceProductName("  ROASTED   ONION & GARLIC  ")).toBe(
			"Roasted Onion & Garlic",
		);
	});

	it("does not alter a word that merely contains and", () => {
		expect(formatSourceProductName("CANDY AND ALMONDS")).toBe(
			"Candy & Almonds",
		);
	});

	it("detects names written entirely in capitals", () => {
		expect(isAllCapsProductName("FULL CAPS 2%")).toBe(true);
		expect(isAllCapsProductName("Readable Name")).toBe(false);
	});

	it("recognizes current and legacy API-backed food records", () => {
		expect(isManagedProductName({
			fdcId: 123,
			description: "MUSTARD GREENS, RAW",
		})).toBe(true);
		expect(isManagedProductName({
			fdcId: -123,
			customFood: true,
			sourceKey: "open-food-facts",
		})).toBe(true);
		expect(isManagedProductName({
			fdcId: 123,
			nameProvenance: "user",
		})).toBe(false);
	});

	it("title-cases API names while preserving user-owned wording", () => {
		expect(normalizeFoodProductName({
			fdcId: 123,
			description: "Tomato, roma",
		})).toMatchObject({
			description: "Tomato, Roma",
			nameProvenance: "source",
		});
		expect(normalizeFoodProductName({
			fdcId: 123,
			description: "MY PERSONAL TOMATO",
			nameProvenance: "user",
		})).toMatchObject({
			description: "MY PERSONAL TOMATO",
			nameProvenance: "user",
		});
	});
});
