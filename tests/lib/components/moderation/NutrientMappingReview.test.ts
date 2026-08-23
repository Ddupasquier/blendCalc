import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import NutrientMappingReview from "$lib/components/moderation/NutrientMappingReview/NutrientMappingReview.svelte";
import { nutrientMappingReviewWorkspaceFixture } from "../../../fixtures/nutrientMappingReview";

describe("NutrientMappingReview", () => {
	it("explains an ambiguous candidate and exposes only evidence-backed decisions", () => {
		render(NutrientMappingReview, {
			props: { workspace: nutrientMappingReviewWorkspaceFixture },
		});

		expect(screen.getByText("Possible protein")).toBeInTheDocument();
		expect(screen.getByText("Needs review")).toBeInTheDocument();
		expect(screen.getByText("Provider key")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Approve nutrient mapping" }))
			.toBeInTheDocument();
		expect(screen.getByLabelText("Confirmed nutrient")).toBeInTheDocument();
		expect(screen.getByText(/does not silently rewrite older nutrient records/u))
			.toBeInTheDocument();
	});

	it("shows completed work without another decision form", () => {
		render(NutrientMappingReview, {
			props: {
				workspace: {
					...nutrientMappingReviewWorkspaceFixture,
					mapping: {
						...nutrientMappingReviewWorkspaceFixture.mapping,
						reviewStatus: "approved",
					},
				},
			},
		});

		expect(screen.getByText("Resolved")).toBeInTheDocument();
		expect(screen.getByText("Review complete")).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Approve nutrient mapping" }))
			.not.toBeInTheDocument();
	});
});
