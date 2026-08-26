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

		await fireEvent.click(screen.getByText("Product conflicts"));
		expect(screen.getByRole("link", { name: /Peanut Butter/ })).toHaveAttribute(
			"href",
			"/profile/privileged-tools/catalog-review-work/products/product-id",
		);
		expect(screen.getByText(/Ingredients/)).toBeInTheDocument();
	});
});
