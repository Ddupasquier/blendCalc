import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import FoodWarningFollowUpReview from "$lib/components/moderation/FoodWarningFollowUpReview/FoodWarningFollowUpReview.svelte";

const reviewCase = {
	id: "case-id",
	caseType: "rule_review" as const,
	responsibleGroup: "food_policy_review",
	status: "open",
	sourceKey: "shared-catalog",
	createdAt: "2026-09-10T12:00:00.000Z",
	resolutionNote: null,
	productName: "Test product",
	barcode: "00012345678905",
	feedbackType: "incorrect_warning",
	preferenceType: null,
	preferenceValue: null,
	reportReason: "wrong_evidence_type",
	reportDetails: "The package lists a different allergen.",
	issueCode: "FOOD_ALLERGEN_CONTAINS",
	issueParams: { factLabel: "soy" },
	policyVersion: 2,
	initialReviewStatus: "confirmed",
	initialResolutionAction: "rule_review",
	initialReviewNote:
		"The package and captured fact disagree, so the policy needs review.",
	initialReviewedAt: "2026-09-10T12:30:00.000Z",
	facts: [
		{
			label: "Soy",
			factType: "contains",
			sourceType: "label_allergen_field",
			sourceText: "Contains: soy.",
			confidence: "confirmed",
		},
	],
};

describe("FoodWarningFollowUpReview", () => {
	it("states the effect of every outcome and gates submission on a deliberate note", async () => {
		render(FoodWarningFollowUpReview, {
			props: { reviewCase, canResolve: true },
		});

		const button = screen.getByRole("button", { name: "Save outcome" });
		expect(button).toBeDisabled();
		expect(
			screen.getByText("The label lists soy as an allergen."),
		).toBeVisible();
		expect(
			screen.getByText(
				"The package and captured fact disagree, so the policy needs review.",
			),
		).toBeVisible();
		expect(screen.getByText("Contains: Soy")).toBeVisible();
		expect(screen.getByText(/Package allergen statement/u)).toBeVisible();
		await fireEvent.click(
			screen.getByRole("combobox", {
				name: "1. What did the evidence establish?",
			}),
		);
		await fireEvent.click(
			screen.getByRole("option", {
				name: "Defer — a named prerequisite is still missing",
			}),
		);
		expect(
			screen.getByText(/Defer keeps the follow-up in the work list/u),
		).toBeVisible();
		await fireEvent.input(
			screen.getByLabelText("2. What evidence supports this outcome?"),
			{ target: { value: "Provider documentation is not available." } },
		);
		expect(
			screen.getByRole("button", { name: "Defer with prerequisite" }),
		).toBeEnabled();
	});

	it("shows a permission-limited handoff with no writable fields", () => {
		render(FoodWarningFollowUpReview, {
			props: {
				reviewCase: {
					...reviewCase,
					caseType: "source_correction",
					responsibleGroup: "data_operations",
				},
				canResolve: false,
			},
		});

		expect(
			screen.getByText("This action needs a Data operations reviewer"),
		).toBeVisible();
		expect(screen.getByText(/Nothing changes/u)).toBeVisible();
		expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
		expect(screen.queryByRole("button")).not.toBeInTheDocument();
	});

	it("renders a terminal follow-up as a read-only audit receipt", () => {
		render(FoodWarningFollowUpReview, {
			props: {
				reviewCase: {
					...reviewCase,
					status: "resolved",
					resolutionNote:
						"Reviewed policy source confirms the current behavior.",
				},
				canResolve: false,
			},
		});

		expect(screen.getByText("Resolved")).toBeVisible();
		expect(screen.getByText("This follow-up is finished")).toBeVisible();
		expect(
			screen.getByText("Reviewed policy source confirms the current behavior."),
		).toBeVisible();
		expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
		expect(screen.queryByRole("button")).not.toBeInTheDocument();
	});

	it("describes a missing warning without claiming one was shown", () => {
		render(FoodWarningFollowUpReview, {
			props: {
				reviewCase: {
					...reviewCase,
					feedbackType: "missing_warning",
					preferenceType: "allergen",
					preferenceValue: "Milk",
					issueCode: null,
					issueParams: {},
					facts: [],
				},
				canResolve: true,
			},
		});

		expect(screen.getByText("Warning missing at report time")).toBeVisible();
		expect(
			screen.getByText(
				"No Milk warning was shown when the report was created.",
			),
		).toBeVisible();
		expect(screen.getByText(/No matching fact was captured/u)).toBeVisible();
	});
});
