import { describe, expect, it, vi } from "vitest";
import {
	parseFoodCompatibilityFeedbackRequest,
	parseMissingFoodWarningFeedbackRequest,
	reviewFoodCompatibilityFeedback,
} from "$lib/server/food-safety/foodCompatibilityFeedback.server";

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

describe("parseMissingFoodWarningFeedbackRequest", () => {
	const createValidFormData = () => {
		const formData = new FormData();
		formData.set("sharedProductId", "418a0615-a025-4b28-9fc9-f1ea62dddca4");
		formData.set("sourceKey", "open-food-facts");
		formData.set("sourceId", "00011110129505");
		formData.set("barcode", "00011110129505");
		formData.set("foodDescription", "Example Product");
		formData.set("preferenceTagId", "6cd4fcf5-9221-4b5b-ae90-b0d20f26af1b");
		formData.set("preferenceType", "allergen");
		formData.set("observedLabelDate", "2026-07-30");
		formData.set(
			"reportDetails",
			"The current ingredients list includes milk, but no dairy warning appeared.",
		);
		return formData;
	};

	it("accepts a bounded missing-warning report", () => {
		expect(parseMissingFoodWarningFeedbackRequest(createValidFormData()))
			.toEqual(expect.objectContaining({
				preferenceType: "allergen",
				observedLabelDate: "2026-07-30",
				evidenceFile: null,
			}));
	});

	it("rejects unreviewed preference identifiers and short explanations", () => {
		const formData = createValidFormData();
		formData.set("preferenceTagId", "not-a-uuid");
		formData.set("reportDetails", "Milk");

		expect(parseMissingFoodWarningFeedbackRequest(formData)).toBeNull();
	});

	it("rejects future or invalid package dates", () => {
		const formData = createValidFormData();
		formData.set("observedLabelDate", "2099-01-01");

		expect(parseMissingFoodWarningFeedbackRequest(formData)).toBeNull();
	});
});

describe("reviewFoodCompatibilityFeedback", () => {
	it("uses the authenticated atomic review contract and preserves follow-up identity", async () => {
		const rpc = vi.fn().mockResolvedValue({
			data: {
				reviewed: true,
				followUpStatus: "open",
				followUpType: "product_correction",
				followUpId: "correction-origin-id",
			},
			error: null,
		});

		await expect(reviewFoodCompatibilityFeedback({ rpc } as never, {
			id: "feedback-id",
			status: "confirmed",
			resolutionAction: "product_correction",
			reviewNote: "Current package evidence supports a product correction.",
		})).resolves.toEqual({
			reviewed: true,
			followUpStatus: "open",
			followUpType: "product_correction",
			followUpId: "correction-origin-id",
		});
		expect(rpc).toHaveBeenCalledWith("review_food_compatibility_feedback", {
			p_feedback_id: "feedback-id",
			p_status: "confirmed",
			p_resolution_action: "product_correction",
			p_review_note: "Current package evidence supports a product correction.",
		});
	});

	it("rejects malformed database responses instead of losing follow-up state", async () => {
		await expect(reviewFoodCompatibilityFeedback({
			rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
		} as never, {
			id: "feedback-id",
			status: "dismissed",
			resolutionAction: "none",
			reviewNote: "The current warning is supported.",
		})).rejects.toThrow(/invalid response/u);
	});
});
