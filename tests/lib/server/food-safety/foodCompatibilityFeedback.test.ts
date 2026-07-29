import { describe, expect, it } from "vitest";
import { parseFoodCompatibilityFeedbackRequest } from "$lib/server/food-safety/foodCompatibilityFeedback.server";

const validRequest = {
	sharedProductId: "418a0615-a025-4b28-9fc9-f1ea62dddca4",
	sourceKey: "open_food_facts",
	sourceId: "00011110129505",
	barcode: "00011110129505",
	foodDescription: "Example Product",
	warningId: "warning-1",
	issueCode: "FOOD_ALLERGEN_CONTAINS",
	issueParams: {
		allergen: "Peanut",
	},
	factSnapshot: [
		{
			tagSlug: "peanut",
			factType: "contains",
			sourceType: "explicit_allergen",
			sourceText: "peanuts",
			confidence: "reported",
		},
	],
	reportReason: "incorrect_match",
	reportDetails: "The current package no longer lists peanuts.",
};

describe("parseFoodCompatibilityFeedbackRequest", () => {
	it("accepts a bounded compatibility-warning report", () => {
		expect(parseFoodCompatibilityFeedbackRequest(validRequest)).toEqual(
			validRequest,
		);
	});

	it("rejects issue codes that are not compatibility warnings", () => {
		expect(parseFoodCompatibilityFeedbackRequest({
			...validRequest,
			issueCode: "CATEGORY_REQUIRED",
		})).toBeNull();
	});

	it("rejects nested issue parameters instead of persisting arbitrary JSON", () => {
		expect(parseFoodCompatibilityFeedbackRequest({
			...validRequest,
			issueParams: {
				allergen: { value: "Peanut" },
			},
		})).toBeNull();
	});

	it("bounds evidence and user-authored details", () => {
		const parsed = parseFoodCompatibilityFeedbackRequest({
			...validRequest,
			factSnapshot: Array.from({ length: 20 }, (_, index) => ({
				tagSlug: `tag-${index}`,
			})),
			reportDetails: "x".repeat(1200),
		});

		expect(parsed?.factSnapshot).toHaveLength(12);
		expect(parsed?.reportDetails).toHaveLength(1000);
	});
});
