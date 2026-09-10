import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import NutrientMappingReview from "$lib/components/moderation/NutrientMappingReview/NutrientMappingReview.svelte";
import { nutrientMappingReviewWorkspaceFixture } from "../../../fixtures/nutrientMappingReview";

describe("NutrientMappingReview", () => {
	it("explains an ambiguous candidate and requires a deliberate evidence-backed decision", async () => {
		render(NutrientMappingReview, {
			props: { workspace: nutrientMappingReviewWorkspaceFixture },
		});

		expect(screen.getByText("Possible protein")).toBeInTheDocument();
		expect(screen.getByText("Needs review")).toBeInTheDocument();
		expect(screen.getByText("Provider key")).toBeInTheDocument();
		expect(
			screen.getByRole("combobox", {
				name: "1. What does the evidence support?",
			}),
		).toHaveTextContent("Choose a decision");
		expect(
			screen.queryByRole("button", { name: "Approve nutrient mapping" }),
		).not.toBeInTheDocument();
		expect(
			screen.queryByLabelText("Confirmed nutrient"),
		).not.toBeInTheDocument();
		expect(
			screen.getByText(/does not silently rewrite older nutrient records/u),
		).toBeInTheDocument();

		await fireEvent.click(
			screen.getByRole("combobox", {
				name: "1. What does the evidence support?",
			}),
		);
		await fireEvent.click(
			screen.getByRole("option", {
				name: "Approve — evidence proves an exact identity",
			}),
		);
		expect(screen.getByLabelText("Confirmed nutrient")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Approve nutrient mapping" }),
		).toBeDisabled();
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
		expect(
			screen.queryByRole("button", { name: "Approve nutrient mapping" }),
		).not.toBeInTheDocument();
	});
});
