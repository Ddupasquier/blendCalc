import { describe, expect, it } from "vitest";
import { getFoodPassportPresentation } from "$lib/utils/food/records/foodPassport";
import type { FoodItem } from "$lib/utils/food/types";

const makeFood = (overrides: Partial<FoodItem> = {}): FoodItem => ({
	fdcId: 1,
	description: "Example food",
	foodNutrients: [],
	...overrides,
});

describe("getFoodPassportPresentation", () => {
	it("summarizes an evolving verified catalog record without exposing technical source ranking", () => {
		const passport = getFoodPassportPresentation(makeFood({
			sharedProductId: "product-1",
			trustStatus: "moderator-reviewed",
			reportedNutrientIds: [1003, 1004],
			foodNutrients: [
				{ nutrientId: 1003, nutrientNumber: "203", nutrientName: "Protein", unitName: "G", value: 5 },
				{ nutrientId: 1004, nutrientNumber: "204", nutrientName: "Total fat", unitName: "G", value: 2 },
			],
			foodServings: [{
				label: "1 cup",
				gramWeight: 240,
				isPrimary: true,
				source: "user-label",
			}],
			ingredients: "Milk, cultures",
			allergenDisclosure: { contains: ["Milk"], mayContain: [] },
			image: {
				source: "community-reviewed",
				role: "front",
				imageUrl: "https://example.com/yogurt.jpg",
				licenseName: "Submitted evidence",
				confidence: "moderator-reviewed",
			},
			fieldProvenance: {
				nutrition: { source: "usda" },
				ingredients: { source: "open-food-facts" },
			},
			canonicalCatalogMetadata: {
				recordCreatedAt: "2026-07-01T00:00:00.000Z",
				recordUpdatedAt: "2026-08-10T00:00:00.000Z",
				lastVerifiedAt: "2026-08-11T00:00:00.000Z",
				currentRevisionId: "revision-3",
				currentRevisionNumber: 3,
				currentRevisionCreatedAt: "2026-08-10T00:00:00.000Z",
				currentLabelObservedAt: "2026-08-09T00:00:00.000Z",
			},
		}));

		expect(passport.statusLabel).toBe("Verified");
		expect(passport.summary).toContain("keep evolving");
		expect(passport.historyRows).toEqual([
			{ label: "Last checked", value: "Aug 11, 2026" },
			{ label: "Current revision", value: "Revision 3" },
			{ label: "Current label observed", value: "Aug 9, 2026" },
			{ label: "Shared since", value: "Jul 1, 2026" },
		]);
		expect(passport.availabilityRows).toEqual(expect.arrayContaining([
			expect.objectContaining({ label: "Nutrition", value: "2 reported nutrient values" }),
			expect.objectContaining({ label: "Ingredients", available: true }),
			expect.objectContaining({ label: "Package safety", value: "Contains details available" }),
			expect.objectContaining({ label: "Field history", value: "2 field sources recorded" }),
		]));
		expect(JSON.stringify(passport)).not.toMatch(/USDA|Open Food Facts/);
	});

	it("keeps missing package safety information unknown rather than claiming safety", () => {
		const passport = getFoodPassportPresentation(makeFood({
			foodIdentityType: "packaged",
			trustStatus: "unverified",
		}));
		const safetyRow = passport.availabilityRows.find(
			(row) => row.label === "Package safety",
		);

		expect(passport.statusLabel).toBe("Unverified");
		expect(safetyRow).toEqual({
			label: "Package safety",
			value: "Not provided",
			available: false,
		});
	});

	it("distinguishes a private food and generic package-label applicability", () => {
		const personal = getFoodPassportPresentation(makeFood({
			foodIdentityType: "private-custom",
			trustStatus: "user-private",
		}));
		const generic = getFoodPassportPresentation(makeFood({
			foodIdentityType: "generic",
			sourceKey: "usda",
		}));

		expect(personal.statusLabel).toBe("Personal");
		expect(personal.historyRows).toEqual([]);
		expect(generic.statusLabel).toBe("Source record");
		expect(generic.availabilityRows.find((row) => row.label === "Package safety"))
			.toMatchObject({ value: "Package labels do not apply", available: true });
	});
});
