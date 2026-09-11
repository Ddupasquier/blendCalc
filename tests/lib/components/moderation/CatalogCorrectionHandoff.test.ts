import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import CatalogCorrectionHandoff from "$lib/components/moderation/CatalogCorrectionHandoff/CatalogCorrectionHandoff.svelte";

const finding = {
	id: "finding-id",
	type: "catalog_conflict" as const,
	label: "Open catalog conflict",
	affectedFieldPaths: ["ingredients"],
	evidence: [
		{ source: "Current label", value: "Peanuts, salt" },
		{ source: "Provider observation", value: "Peanuts, sugar, salt" },
	],
	status: "needs_correction" as const,
	submissionId: null,
};

describe("CatalogCorrectionHandoff", () => {
	it("opens the existing correction flow and explains both review outcomes", () => {
		render(CatalogCorrectionHandoff, {
			props: {
				handoff: {
					applicationFoodId: 123,
					pendingSubmissionId: null,
					findings: [finding],
				},
				returnPath:
					"/profile/privileged-tools/catalog-review-work/products/product-id",
			},
		});

		expect(screen.getByText("Open catalog conflict")).toBeVisible();
		expect(screen.getByText("Ingredients")).toBeVisible();
		expect(screen.getByText("Peanuts, salt")).toBeVisible();
		expect(
			screen.getByText(/Approval applies only the reviewed changes/u),
		).toBeVisible();
		expect(
			screen.getByText(
				/rejection leaves the current catalog product unchanged/u,
			),
		).toBeVisible();
		expect(
			screen.getByRole("link", { name: "Open prefilled correction" }),
		).toHaveAttribute(
			"href",
			"/ingredients/fridge/nutrition/123/correct-information?actions=hide&returnTo=%2Fprofile%2Fprivileged-tools%2Fcatalog-review-work%2Fproducts%2Fproduct-id",
		);
	});

	it("offers an evidence-gated terminal outcome when the current value is correct", () => {
		render(CatalogCorrectionHandoff, {
			props: {
				handoff: {
					applicationFoodId: 123,
					pendingSubmissionId: null,
					findings: [finding],
				},
				returnPath:
					"/profile/privileged-tools/catalog-review-work/products/product-id",
				allowConflictResolution: true,
			},
		});

		expect(
			screen.getByText(
				/The product stays unchanged, this conflict leaves the queue/u,
			),
		).toBeVisible();
		expect(
			screen.getByRole("button", {
				name: "Keep current value and resolve conflict",
			}),
		).toBeDisabled();
	});

	it("routes linked work to its one existing submission instead of offering a duplicate", () => {
		render(CatalogCorrectionHandoff, {
			props: {
				handoff: {
					applicationFoodId: 123,
					pendingSubmissionId: "submission-id",
					findings: [
						{
							...finding,
							status: "correction_submitted",
							submissionId: "submission-id",
						},
					],
				},
				returnPath:
					"/profile/privileged-tools/catalog-review-work/products/product-id",
			},
		});

		expect(screen.getByText(/Do not create a duplicate/u)).toBeVisible();
		expect(
			screen.getByRole("link", { name: "Review linked submission" }),
		).toHaveAttribute("href", "/profile/privileged-tools/product-submissions");
		expect(
			screen.queryByRole("link", { name: "Open prefilled correction" }),
		).not.toBeInTheDocument();
	});

	it("does not offer a duplicate while any correction for the product is pending", () => {
		render(CatalogCorrectionHandoff, {
			props: {
				handoff: {
					applicationFoodId: 123,
					pendingSubmissionId: "pending-submission-id",
					findings: [finding],
				},
				returnPath:
					"/profile/privileged-tools/catalog-review-work/products/product-id",
			},
		});

		expect(
			screen.getByText("A correction is already waiting for review"),
		).toBeVisible();
		expect(
			screen.getByRole("link", { name: "Review linked submission" }),
		).toHaveAttribute("href", "/profile/privileged-tools/product-submissions");
		expect(
			screen.queryByRole("link", { name: "Open prefilled correction" }),
		).not.toBeInTheDocument();
	});

	it("names the missing identity prerequisite without a dead action", () => {
		render(CatalogCorrectionHandoff, {
			props: {
				handoff: {
					applicationFoodId: null,
					pendingSubmissionId: null,
					findings: [finding],
				},
				returnPath:
					"/profile/privileged-tools/catalog-review-work/products/product-id",
			},
		});

		expect(screen.getByText("Correction cannot start yet")).toBeVisible();
		expect(screen.getByText(/Nothing has changed/u)).toBeVisible();
		expect(
			screen.queryByRole("link", { name: "Open prefilled correction" }),
		).not.toBeInTheDocument();
	});
});
