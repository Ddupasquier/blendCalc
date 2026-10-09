import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import CatalogReviewProductInbox from "$lib/components/moderation/CatalogReviewProductInbox/CatalogReviewProductInbox.svelte";

describe("CatalogReviewProductInbox composition", () => {
	it("uses authoritative counts and the shared footer rather than counting loaded findings", () => {
		const id = "99978000-0000-4000-8000-000000000001";
		render(CatalogReviewProductInbox, {
			props: {
				scrollContainer: null,
				page: {
					items: [
						{
							id,
							productId: id,
							barcode: "00011110129505",
							productName: "Peanut Butter",
							brandOwner: null,
							oldestReviewAt: "2026-10-03T12:00:00.123456Z",
							counts: {
								conflicts: 61,
								providerChanges: 0,
								safetyMatches: 0,
								total: 61,
							},
						},
					],
					total: 41,
					nextCursor: "next",
					revision: "a".repeat(32),
					counts: { conflicts: 101, providerChanges: 0, safetyMatches: 0 },
				},
			},
		});
		expect(screen.getByLabelText("Products pagination")).toHaveTextContent(
			"1 of 41 products loaded",
		);
		expect(screen.getByText("61 conflicts")).toBeVisible();
		expect(
			screen.getByRole("button", { name: "Load more products" }),
		).toBeEnabled();
	});
});
