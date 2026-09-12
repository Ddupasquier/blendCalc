import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import CatalogCorrectionHandoff from "$lib/components/moderation/CatalogCorrectionHandoff/CatalogCorrectionHandoff.svelte";

const finding = {
	id: "finding-id",
	type: "catalog_conflict" as const,
	label: "Open catalog conflict",
	fieldLabel: "Sodium, Na",
	comparisonBasis: "per 100 g",
	affectedFieldPaths: ["nutrient:1093"],
	currentValue: {
		index: null,
		source: "USDA FoodData Central · record 373595",
		sourceKey: "usda",
		sourceReference: "373595",
		value: "59 mg · per 100 g",
		amountPer100g: 59,
		unit: "mg",
		observedAt: "2026-08-01T00:00:00Z",
		sourceType: "government_dataset",
		sourceUrl: "https://fdc.nal.usda.gov/",
		redistributionAllowed: true,
	},
	evidence: [
		{
			index: 0,
			source: "USDA FoodData Central · record 373595",
			sourceKey: "usda",
			sourceReference: "373595",
			value: "59 mg · per 100 g",
			amountPer100g: 59,
			unit: "mg",
			observedAt: "2026-08-01T00:00:00Z",
			sourceType: "government_dataset",
			sourceUrl: "https://fdc.nal.usda.gov/",
			redistributionAllowed: true,
		},
		{
			index: 1,
			source: "Open Food Facts · record 00000000772914",
			sourceKey: "open-food-facts",
			sourceReference: "00000000772914",
			value: "40 mg · per 100 g",
			amountPer100g: 40,
			unit: "mg",
			observedAt: "2026-08-02T00:00:00Z",
			sourceType: "community_database",
			sourceUrl: "https://world.openfoodfacts.org/",
			redistributionAllowed: true,
		},
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
		expect(screen.getByText("Sodium, Na")).toBeVisible();
		expect(
			screen.getByText("Stored catalog value — this is what “keep” preserves"),
		).toBeVisible();
		expect(screen.getAllByText("59 mg · per 100 g")).toHaveLength(2);
		expect(screen.getByText("40 mg · per 100 g")).toBeVisible();
		expect(
			screen.getByText("Every value below is shown per 100 g."),
		).toBeVisible();
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
			"/ingredients/fridge/nutrition/123/correct-information?actions=hide&returnTo=%2Fprofile%2Fprivileged-tools%2Fcatalog-review-work%2Fproducts%2Fproduct-id&evidence=none",
		);
	});

	it("requests field-specific photos when no observation can be reused", () => {
		render(CatalogCorrectionHandoff, {
			props: {
				handoff: {
					applicationFoodId: 123,
					pendingSubmissionId: null,
					findings: [
						{
							...finding,
							evidence: finding.evidence.map((observation) => ({
								...observation,
								redistributionAllowed: false,
							})),
						},
					],
				},
				returnPath:
					"/profile/privileged-tools/catalog-review-work/products/product-id",
			},
		});

		expect(
			screen.getByRole("link", { name: "Open prefilled correction" }),
		).toHaveAttribute(
			"href",
			"/ingredients/fridge/nutrition/123/correct-information?actions=hide&returnTo=%2Fprofile%2Fprivileged-tools%2Fcatalog-review-work%2Fproducts%2Fproduct-id&evidence=nutrition",
		);
	});

	it("opens an embedded correction without navigating away", async () => {
		const onOpenCorrection = vi.fn();
		render(CatalogCorrectionHandoff, {
			props: {
				handoff: {
					applicationFoodId: 123,
					pendingSubmissionId: null,
					findings: [finding],
				},
				returnPath:
					"/profile/privileged-tools/catalog-review-work/products/product-id",
				onOpenCorrection,
			},
		});

		expect(
			screen.queryByRole("link", { name: "Open prefilled correction" }),
		).not.toBeInTheDocument();
		await fireEvent.click(
			screen.getByRole("button", { name: "Open prefilled correction" }),
		);
		expect(onOpenCorrection).toHaveBeenCalledWith([]);
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
				name: "Keep stored value and resolve conflict",
			}),
		).toBeDisabled();
	});

	it("does not offer a keep action when the stored value cannot be identified", () => {
		render(CatalogCorrectionHandoff, {
			props: {
				handoff: {
					applicationFoodId: 123,
					pendingSubmissionId: null,
					findings: [{ ...finding, currentValue: null }],
				},
				returnPath:
					"/profile/privileged-tools/catalog-review-work/products/product-id",
				allowConflictResolution: true,
			},
		});

		expect(
			screen.getByText("Stored value could not be identified"),
		).toBeVisible();
		expect(
			screen.queryByRole("button", {
				name: "Keep stored value and resolve conflict",
			}),
		).not.toBeInTheDocument();
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
