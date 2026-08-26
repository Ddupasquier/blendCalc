import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import FoodWarningFollowUpList from "$lib/components/moderation/FoodWarningFollowUpList/FoodWarningFollowUpList.svelte";

describe("FoodWarningFollowUpList", () => {
	it("separates product corrections from policy-owned follow-up work", () => {
		render(FoodWarningFollowUpList, {
			props: {
				followUps: {
					productCorrections: [
						{
							id: "correction-id",
							sharedProductId: "product-id",
							productName: "Peanut Butter",
							barcode: "00869759000149",
							affectedFieldPaths: ["ingredients", "allergens"],
							status: "waiting_for_correction",
							submissionId: null,
							feedbackType: "missing_warning",
							reportReason: "missing_warning",
							createdAt: "2026-08-22T12:00:00.000Z",
						},
					],
					policyReviews: [
						{
							id: "policy-case-id",
							caseType: "rule_review",
							responsibleGroup: "food_policy_review",
							sharedProductId: "product-id",
							productName: "Peanut Butter",
							barcode: "00869759000149",
							sourceKey: "shared-catalog",
							status: "open",
							feedbackType: "incorrect_warning",
							reportReason: "wrong_evidence_type",
							createdAt: "2026-08-22T12:00:00.000Z",
						},
					],
				},
			},
		});

		expect(screen.getByText("Correction needed")).toBeInTheDocument();
		expect(
			screen.getByText(/Ingredients, Allergen declaration/u),
		).toBeInTheDocument();
		expect(
			screen.getByRole("link", {
				name: "Review product and correction status",
			}),
		).toHaveAttribute(
			"href",
			"/profile/privileged-tools/catalog-review-work/products/product-id",
		);
		expect(
			screen.getByText("Owner: Food warning policy review"),
		).toBeInTheDocument();
	});

	it("does not add an empty second queue", () => {
		render(FoodWarningFollowUpList, {
			props: {
				followUps: { productCorrections: [], policyReviews: [] },
			},
		});

		expect(
			screen.queryByText("Warning follow-up work"),
		).not.toBeInTheDocument();
	});
});
