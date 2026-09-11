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
		expect(
			screen.getByRole("group", { name: "Confirmed nutrient" }),
		).toBeInTheDocument();
		expect(screen.getByText("Protein · G")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Approve nutrient mapping" }),
		).toBeDisabled();
	});

	it("shows searchable compatible choices without erasing or disabling the selection", async () => {
		render(NutrientMappingReview, {
			props: { workspace: nutrientMappingReviewWorkspaceFixture },
		});

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

		const search = screen.getByRole("searchbox", {
			name: "Find a compatible nutrient",
		});
		await fireEvent.input(search, { target: { value: "arachidonic" } });

		expect(
			screen.getByText("1 of 3 compatible nutrients match"),
		).toBeInTheDocument();
		const arachidonicChoice = screen.getByRole("button", {
			name: /Fatty acids, polyunsaturated, 20:4 n-6, arachidonic/u,
		});
		expect(arachidonicChoice).toHaveAttribute("aria-pressed", "false");
		await fireEvent.click(arachidonicChoice);
		expect(
			screen.getByText(
				"Fatty acids, polyunsaturated, 20:4 n-6, arachidonic · G",
			),
		).toBeInTheDocument();

		await fireEvent.input(search, { target: { value: "no such nutrient" } });
		expect(
			screen.getByText(/No compatible nutrient matches/u),
		).toHaveTextContent("Your current selection is unchanged");
		expect(
			screen.getByText(
				"Fatty acids, polyunsaturated, 20:4 n-6, arachidonic · G",
			),
		).toBeInTheDocument();

		await fireEvent.click(
			screen.getByRole("button", {
				name: "Clear find a compatible nutrient",
			}),
		);
		expect(
			screen.getByText("3 compatible nutrients available"),
		).toBeInTheDocument();
	});

	it("does not preselect an incompatible suggestion", async () => {
		render(NutrientMappingReview, {
			props: {
				workspace: {
					...nutrientMappingReviewWorkspaceFixture,
					mapping: {
						...nutrientMappingReviewWorkspaceFixture.mapping,
						mappingMethod: "db_reviewed_api_key_match",
						currentNutrient: {
							nutrientId: 1176,
							nutrientName: "Biotin",
							nutrientNumber: "416",
							defaultUnitName: "UG",
						},
					},
					compatibleNutrients:
						nutrientMappingReviewWorkspaceFixture.compatibleNutrients.filter(
							(nutrient) => nutrient.nutrientId !== 1176,
						),
				},
			},
		});

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

		expect(screen.getByText("No nutrient selected yet")).toBeInTheDocument();
		expect(
			screen.getByText("The suggested nutrient is not selectable yet"),
		).toBeInTheDocument();
		expect(
			screen.getByText(/There is no reviewed G-to-UG unit path for Biotin/u),
		).toBeInTheDocument();
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
