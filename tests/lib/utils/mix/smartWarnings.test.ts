import { describe, expect, it } from "vitest";
import { getNutrientGoalWarnings } from "$lib/utils/mix/warnings/smartWarnings";

describe("smart warnings", () => {
	it("reports nutrients over goal", () => {
		const warnings = getNutrientGoalWarnings([
			{
				id: 2000,
				label: "Sugar",
				unit: "g",
				total: 33,
				goal: 25,
			},
		]);

		expect(warnings).toEqual([
			expect.objectContaining({
				id: "over-2000",
				tone: "danger",
				message: "Sugar exceeds goal by 8g.",
			}),
		]);
	});

	it("reports nutrients under target", () => {
		const warnings = getNutrientGoalWarnings([
			{
				id: 1003,
				label: "Protein",
				unit: "g",
				total: 13,
				goal: 25,
			},
		]);

		expect(warnings).toEqual([
			expect.objectContaining({
				id: "under-1003",
				tone: "warning",
				message: "Protein is under target by 12g.",
			}),
		]);
	});

	it("suppresses under-target warnings before ingredients are selected", () => {
		const warnings = getNutrientGoalWarnings(
			[
				{
					id: 1003,
					label: "Protein",
					unit: "g",
					total: 0,
					goal: 25,
				},
			],
			{ includeUnderTargets: false },
		);

		expect(warnings).toEqual([]);
	});
});
