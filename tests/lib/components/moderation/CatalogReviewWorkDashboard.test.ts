import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import CatalogReviewWorkDashboard from "$lib/components/moderation/CatalogReviewWorkDashboard/CatalogReviewWorkDashboard.svelte";

describe("CatalogReviewWorkDashboard", () => {
	it("contains human review decisions without operational diagnostics", async () => {
		render(CatalogReviewWorkDashboard, {
			props: {
				reviewWork: {
					conflicts: [
						{
							id: "conflict-id",
							productId: "product-id",
							barcode: "00011110129505",
							productName: "Peanut Butter",
							fieldPath: "ingredients",
							observedValues: [
								{ source: "label", value: "Peanuts, salt" },
								{ source: "provider", value: "Peanuts, sugar, salt" },
							],
							severity: "high",
							createdAt: "2026-08-22T12:00:00.000Z",
						},
					],
					providerChanges: [],
					safetyMatches: [],
					counts: { conflicts: 1, providerChanges: 0, safetyMatches: 0 },
					issueLimit: 20,
				},
			},
		});

		expect(screen.getByText("Possible recall matches")).toBeInTheDocument();
		expect(screen.getByText("Provider changes")).toBeInTheDocument();
		expect(screen.getByText("Product conflicts")).toBeInTheDocument();
		expect(screen.queryByText("Source activity")).not.toBeInTheDocument();
		expect(
			screen.queryByText("Dataset imports and licensing"),
		).not.toBeInTheDocument();

		expect(screen.getByText("Queues in priority order")).toBeVisible();
		expect(
			screen.getByText("Product conflicts").closest("details"),
		).toHaveAttribute("open");
		expect(screen.getByRole("link", { name: /Peanut Butter/ })).toHaveAttribute(
			"href",
			"/profile/privileged-tools/catalog-review-work/products/product-id",
		);
		expect(screen.getByText(/Ingredients/)).toBeInTheDocument();
		expect(
			screen.getByText(/Peanuts, salt versus Peanuts, sugar, salt/),
		).toBeVisible();
	});

	it("requires a deliberate recall decision and evidence note", async () => {
		render(CatalogReviewWorkDashboard, {
			props: {
				reviewWork: {
					conflicts: [],
					providerChanges: [],
					safetyMatches: [
						{
							id: "match-id",
							sharedProductId: "product-id",
							barcode: "00011110129505",
							productName: "Peanut Butter",
							brandOwner: "QA Foods",
							alertProductDescription: "12 oz Peanut Butter",
							classification: "Class I",
							reason: "Possible undeclared allergen",
							packageDescription: "12 oz jar",
							codeInformation: "Lot QA-1",
							sourceUrl: "https://example.test/recall",
							sourceName: "FDA",
							matchEvidence: { barcode: "exact" },
							requiresPackageCheck: true,
							detectedAt: "2026-08-22T12:00:00.000Z",
						},
					],
					counts: { conflicts: 0, providerChanges: 0, safetyMatches: 1 },
					issueLimit: 20,
				},
			},
		});

		const decision = screen.getByRole("combobox", {
			name: "1. Is this exact product covered by the notice?",
		});
		const save = screen.getByRole("button", { name: "Save safety decision" });
		expect(decision).toHaveTextContent("Choose a decision");
		expect(
			screen.getByText(
				"Yes activates the matched notice and user alerts. No closes the match without attaching the notice to this product.",
			),
		).toBeVisible();
		expect(save).toBeDisabled();
		expect(screen.getByText("Why this was flagged")).toBeVisible();
		expect(
			screen.getByText(
				"Required — verify the package, lot, and date codes before confirming.",
			),
		).toBeVisible();

		await fireEvent.click(decision);
		await fireEvent.click(
			screen.getByRole("option", {
				name: "No — this is a different product",
			}),
		);
		expect(
			screen.getByText(
				"No closes this match without showing the official notice for this product.",
			),
		).toBeVisible();
		await fireEvent.input(
			screen.getByRole("textbox", {
				name: "2. What evidence proves this decision?",
			}),
			{ target: { value: "The notice lists a different lot code." } },
		);
		expect(save).toBeEnabled();
	});

	it("shows provider values and explains the exact keep-current outcome", () => {
		render(CatalogReviewWorkDashboard, {
			props: {
				reviewWork: {
					conflicts: [],
					providerChanges: [
						{
							id: "review-id",
							sharedProductId: "product-id",
							barcode: "00011110129505",
							productName: "Peanut Butter",
							sourceName: "Open Food Facts",
							changeSummary: {
								changes: [
									{
										field: "ingredients",
										label: "Ingredients",
										severity: "high",
										previousValue: "Peanuts, salt",
										observedValue: "Peanuts, sugar, salt",
									},
								],
							},
							materialFieldPaths: ["ingredients"],
							observedAt: "2026-08-22T12:00:00.000Z",
							createdAt: "2026-08-22T12:00:00.000Z",
							correctionStatus: null,
							submissionId: null,
						},
					],
					safetyMatches: [],
					counts: { conflicts: 0, providerChanges: 1, safetyMatches: 0 },
					issueLimit: 20,
				},
			},
		});

		expect(screen.getByText("Earlier provider value")).toBeVisible();
		expect(screen.getByText("Peanuts, sugar, salt")).toBeVisible();
		expect(
			screen.getByText(
				/closes API conflicts created by this exact provider snapshot/u,
			),
		).toBeVisible();
	});
});
