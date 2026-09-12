import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import CatalogReviewProductInbox from "$lib/components/moderation/CatalogReviewProductInbox/CatalogReviewProductInbox.svelte";

describe("CatalogReviewProductInbox", () => {
	it("renders one destination for a product with multiple review items", () => {
		render(CatalogReviewProductInbox, {
			props: {
				reviewWork: {
					conflicts: [
						{
							id: "conflict-a",
							productId: "product-id",
							barcode: "00011110129505",
							productName: "Peanut Butter",
							fieldPath: "ingredients",
							observedValues: [],
							severity: "high",
							createdAt: "2026-08-22T12:00:00.000Z",
						},
						{
							id: "conflict-b",
							productId: "product-id",
							barcode: "00011110129505",
							productName: "Peanut Butter",
							fieldPath: "nutrient:1093",
							observedValues: [],
							severity: "medium",
							createdAt: "2026-08-23T12:00:00.000Z",
						},
					],
					providerChanges: [],
					safetyMatches: [],
					counts: {
						conflicts: 2,
						providerChanges: 0,
						safetyMatches: 0,
					},
					issueLimit: 20,
				},
			},
		});

		expect(screen.getAllByText("Peanut Butter")).toHaveLength(1);
		expect(screen.getByText("2 conflicts")).toBeVisible();
		expect(screen.getByText("2 items")).toBeVisible();
		expect(screen.getByRole("link", { name: /Peanut Butter/ })).toHaveAttribute(
			"href",
			"/profile/privileged-tools/catalog-review-work/products/product-id",
		);
	});
});
