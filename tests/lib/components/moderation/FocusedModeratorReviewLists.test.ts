import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import FoodWarningReportReviewList from "$lib/components/moderation/FoodWarningReportReviewList/FoodWarningReportReviewList.svelte";
import ProductSubmissionReviewList from "$lib/components/moderation/ProductSubmissionReviewList/ProductSubmissionReviewList.svelte";

describe("focused moderator review lists", () => {
	it("explains an empty product-submission queue", () => {
		render(ProductSubmissionReviewList, {
			props: { submissions: [] },
		});

		expect(screen.getByText("0 submissions waiting for review")).toBeInTheDocument();
		expect(screen.getByText("No product submissions need review")).toBeInTheDocument();
	});

	it("explains an empty food-warning queue", () => {
		render(FoodWarningReportReviewList, {
			props: { reports: [] },
		});

		expect(screen.getByText("0 reports waiting for review")).toBeInTheDocument();
		expect(screen.getByText("No food warning reports need review")).toBeInTheDocument();
	});
});
