import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import SaveGoalReview from "$lib/components/mix/save/SaveGoalReview/SaveGoalReview.svelte";

describe("SaveGoalReview", () => {
	it("uses shared semantic pills for concise goal status", () => {
		render(SaveGoalReview, {
			props: {
				diffs: [
					{
						label: "Protein",
						unit: "g",
						total: 22,
						goal: 25,
						upperGoal: null,
						goalType: "minimum",
						difference: -3,
						percentOfGoal: 88,
						status: "under",
					},
				],
			},
		});

		expect(screen.getByText("Protein")).toBeInTheDocument();
		expect(
			screen.getByText("3 g short").closest(".metadata-pill"),
		).toHaveAttribute("data-tone", "warning");
		expect(
			screen.getByText("Actual 22 g · Goal ≥25 g · 88%"),
		).toBeInTheDocument();
	});
});
