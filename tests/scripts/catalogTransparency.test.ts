import {
	CATALOG_TRANSPARENCY_SEMANTICS,
	classifyCoverage,
	createCoverageRow,
	hasSourceQualityMetadata,
	hasStructuredIngredientAnalysis,
} from "../../scripts/lib/catalogTransparency.mjs";
import { describe, expect, it } from "vitest";

describe("catalog transparency audit helpers", () => {
	it("classifies empty, sparse, and fully populated coverage", () => {
		expect(classifyCoverage(0, 10)).toBe("empty");
		expect(classifyCoverage(4, 10)).toBe("sparse");
		expect(classifyCoverage(10, 10)).toBe("populated");
	});

	it("does not infer population when a scope is empty", () => {
		expect(
			createCoverageRow({
				key: "example",
				label: "Example",
				populated: 0,
				total: 0,
			}),
		).toMatchObject({
			state: "empty",
			percent: 0,
		});
	});

	it("requires real source metadata or ingredient analysis", () => {
		expect(hasSourceQualityMetadata({ sourceMetadata: {} })).toBe(false);
		expect(
			hasSourceQualityMetadata({
				sourceMetadata: { completeness: 0 },
			}),
		).toBe(true);
		expect(
			hasStructuredIngredientAnalysis({
				structuredIngredients: [],
			}),
		).toBe(false);
		expect(
			hasStructuredIngredientAnalysis({
				ingredientAnalysis: { percentKnown: 0 },
			}),
		).toBe(true);
	});

	it("defines distinct verification and label-date semantics", () => {
		const lastVerified = CATALOG_TRANSPARENCY_SEMANTICS.find(
			(entry) => entry.key === "lastVerified",
		);
		const currentLabelSince = CATALOG_TRANSPARENCY_SEMANTICS.find(
			(entry) => entry.key === "currentLabelSince",
		);
		expect(lastVerified?.owner).toContain("last_verified_at");
		expect(lastVerified?.missing).toContain("Never substitute updated_at");
		expect(currentLabelSince?.owner).toContain("label_observed_at");
		expect(currentLabelSince?.missing).toContain(
			"not manufacturer label dates",
		);
	});

	it("keeps source quality bounded and separate from attribution", () => {
		const sourceQuality = CATALOG_TRANSPARENCY_SEMANTICS.find(
			(entry) => entry.key === "sourceQuality",
		);

		expect(sourceQuality?.app).toContain("bounded friendly");
		expect(sourceQuality?.app).toContain("raw provider tags remain hidden");
		expect(sourceQuality?.app).toContain("Product details owns");
	});
});
