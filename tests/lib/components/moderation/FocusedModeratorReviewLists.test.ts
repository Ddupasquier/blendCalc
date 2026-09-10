import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import FoodWarningReportReviewList from "$lib/components/moderation/FoodWarningReportReviewList/FoodWarningReportReviewList.svelte";
import type { FoodWarningReportReviewListProps } from "$lib/components/moderation/FoodWarningReportReviewList/types";
import ProductSubmissionReviewList from "$lib/components/moderation/ProductSubmissionReviewList/ProductSubmissionReviewList.svelte";
import type { ProductSubmissionReviewListProps } from "$lib/components/moderation/ProductSubmissionReviewList/types";

const productSubmission = {
	id: "submission-1",
	barcode: "00850000487260",
	productName: "Reviewed Peanut Butter",
	brandOwner: "QA Foods",
	matchedSource: "USDA FoodData Central",
	matchedReference: "fdc-123",
	createdAt: "2026-08-20T10:00:00.000Z",
	evidenceComplete: true,
	evidence: [
		{
			key: "nutrition",
			label: "Nutrition facts",
			url: "https://example.test/nutrition.webp",
		},
	],
	frontEvidenceUrl: null,
	imageCrop: {
		cropX: 50,
		cropY: 50,
		cropZoom: 1,
		rotationDegrees: 0,
		fitMode: "contain",
		placementVersion: 1,
		placementMethod: "default",
	},
	conflictCount: 1,
	externalLookupFailed: false,
	validationIssues: ["Serving size differs from the current catalog record."],
	trustDisposition: "conflicts-with-trusted-evidence",
	isQaFixture: false,
	submissionKind: "packaged_product",
	submissionIntent: "new_product",
	labelObservedAt: "2026-08-20T10:00:00.000Z",
	labelObservedDate: "2026-08-20",
	updateReview: null,
	nutrients: [{ name: "Protein", value: 8, unit: "g" }],
} satisfies ProductSubmissionReviewListProps["submissions"][number];

const foodWarningReport = {
	id: "warning-report-1",
	feedbackType: "missing_warning",
	reportedBy: "user-1",
	sharedProductId: "product-1",
	sharedProductRevisionId: "revision-1",
	sourceKey: "shared-catalog",
	sourceId: "product-1",
	barcode: "00850000487260",
	foodDescription: "Reviewed Peanut Butter",
	warningId: null,
	issueCode: null,
	issueParams: { factLabel: "Peanut" },
	factSnapshot: {
		facts: [
			{
				slug: "peanut",
				label: "Peanut",
				category: "allergen",
				factType: "contains",
				sourceType: "label_allergen_field",
				sourceText: "Contains: Peanuts",
				confidence: "confirmed",
			},
		],
	},
	preferenceType: "allergen",
	preferenceValue: "Peanut",
	observedLabelDate: "2026-08-20",
	evidenceUrl: "https://example.test/label.webp",
	reportReason: "missing_warning",
	reportDetails: "The current package explicitly lists peanuts.",
	createdAt: "2026-08-20T10:00:00.000Z",
	policyVersion: 3,
} satisfies FoodWarningReportReviewListProps["reports"][number];

describe("focused moderator review lists", () => {
	it("explains an empty product-submission queue", () => {
		render(ProductSubmissionReviewList, {
			props: { submissions: [] },
		});

		expect(
			screen.getByText("0 submissions waiting for review"),
		).toBeInTheDocument();
		expect(
			screen.getByText("No product submissions need review"),
		).toBeInTheDocument();
	});

	it("keeps supporting evidence bounded and requires a deliberate product decision", async () => {
		render(ProductSubmissionReviewList, {
			props: { submissions: [productSubmission] },
		});

		expect(screen.getByText("Reviewed Peanut Butter")).toBeVisible();
		expect(screen.getByText("1 submission waiting for review")).toBeVisible();
		expect(
			screen.getByText("Serving size differs from the current catalog record."),
		).toBeVisible();
		expect(screen.getByText("Trusted evidence conflict")).toBeVisible();
		expect(screen.getByText("Nutrition facts")).not.toBeVisible();
		expect(
			screen.getByRole("combobox", {
				name: "1. What does the package evidence support?",
			}),
		).toHaveTextContent("Choose a decision");
		expect(
			screen.queryByRole("button", { name: "Approve and publish submission" }),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Reject submission" }),
		).not.toBeInTheDocument();
		expect(
			screen.getByText(/Rejection keeps them unpublished and saves/),
		).toBeVisible();

		await fireEvent.click(screen.getByText("Package evidence"));

		expect(screen.getByText("Nutrition facts")).toBeVisible();

		await fireEvent.click(
			screen.getByRole("combobox", {
				name: "1. What does the package evidence support?",
			}),
		);
		await fireEvent.click(
			screen.getByRole("option", {
				name: "Approve — every submitted value is supported",
			}),
		);
		expect(
			screen.getByRole("button", {
				name: "Approve and publish submission",
			}),
		).toBeEnabled();
	});

	it("explains an empty food-warning queue", () => {
		render(FoodWarningReportReviewList, {
			props: { reports: [] },
		});

		expect(
			screen.getByText("0 reports waiting for review"),
		).toBeInTheDocument();
		expect(
			screen.getByText("No food warning reports need review"),
		).toBeInTheDocument();
	});

	it("explains the report, evidence, and safe decision sequence", async () => {
		render(FoodWarningReportReviewList, {
			props: { reports: [foodWarningReport] },
		});

		expect(screen.getByText("Reviewed Peanut Butter")).toBeVisible();
		expect(screen.getByText("Missing warning · Policy v3")).toBeVisible();
		expect(
			screen.getByText("The current package explicitly lists peanuts."),
		).toBeVisible();
		expect(
			screen.getByText(
				"The user expected a Peanut warning, but blendCalc did not show one.",
			),
		).toBeVisible();
		expect(
			screen.getByText(
				"No Peanut warning was active when this report was created.",
			),
		).toBeVisible();
		expect(screen.getByText("Contains: Peanut")).toBeVisible();
		expect(
			screen.getByText("Open the user’s package-label evidence"),
		).toBeVisible();
		expect(screen.getByText(/"issueParams"/)).not.toBeVisible();

		const decision = screen.getByRole("combobox", {
			name: "1. Is the user’s report supported?",
		});
		const nextStep = screen.getByRole("combobox", {
			name: "2. What should happen next?",
		});
		const saveReview = screen.getByRole("button", { name: "Save review" });
		expect(nextStep).toBeDisabled();
		expect(saveReview).toBeDisabled();
		expect(
			screen.getByText(
				"Yes confirms the report and can create follow-up work. No dismisses it and preserves the current warning behavior.",
			),
		).toBeVisible();

		await fireEvent.click(decision);
		await fireEvent.click(
			screen.getByRole("option", {
				name: "Yes — blendCalc missed this warning",
			}),
		);
		expect(nextStep).toBeEnabled();
		await fireEvent.click(nextStep);
		await fireEvent.click(
			screen.getByRole("option", {
				name: "Correct product data — stored food facts are wrong",
			}),
		);
		await fireEvent.input(
			screen.getByRole("textbox", {
				name: "3. What evidence supports this decision?",
			}),
			{ target: { value: "The package label confirms the missing warning." } },
		);
		expect(saveReview).toBeEnabled();

		await fireEvent.click(screen.getByText("Technical record details"));
		expect(screen.getByText(/"issueParams"/)).toBeVisible();
	});
});
