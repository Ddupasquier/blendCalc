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
	issueParams: { preference: "peanut" },
	factSnapshot: { contains: ["peanut"] },
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

	it("keeps product evidence closed while exposing the decision controls", async () => {
		render(ProductSubmissionReviewList, {
			props: { submissions: [productSubmission] },
		});

		expect(screen.getByText("Reviewed Peanut Butter")).toBeVisible();
		expect(screen.getByText("1 submission waiting for review")).toBeVisible();
		expect(
			screen.getByText("Serving size differs from the current catalog record."),
		).toBeVisible();
		expect(screen.getByText("Nutrition facts")).not.toBeVisible();
		expect(
			screen.getByRole("button", { name: "Approve submission" }),
		).toBeEnabled();
		expect(
			screen.getByRole("button", { name: "Reject submission" }),
		).toBeEnabled();

		await fireEvent.click(screen.getByText("Package evidence"));

		expect(screen.getByText("Nutrition facts")).toBeVisible();
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

	it("presents one warning report with evidence and an explicit next step", async () => {
		render(FoodWarningReportReviewList, {
			props: { reports: [foodWarningReport] },
		});

		expect(screen.getByText("Reviewed Peanut Butter")).toBeVisible();
		expect(screen.getByText("Missing warning · Policy v3")).toBeVisible();
		expect(
			screen.getByText("The current package explicitly lists peanuts."),
		).toBeVisible();
		expect(
			screen.getByText("Open private package-label evidence"),
		).not.toBeVisible();
		expect(screen.getByRole("combobox", { name: "Decision" })).toBeVisible();
		expect(screen.getByRole("combobox", { name: "Next step" })).toBeVisible();
		expect(screen.getByRole("button", { name: "Save review" })).toBeEnabled();

		await fireEvent.click(screen.getByText("Report evidence"));

		expect(
			screen.getByText("Open private package-label evidence"),
		).toBeVisible();
	});
});
