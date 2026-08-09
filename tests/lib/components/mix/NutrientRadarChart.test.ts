import { render } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import NutrientRadarChart from "$lib/components/mix/insights/NutrientRadarChart/NutrientRadarChart.svelte";
import { getNutrientRadarChartAxisOrder } from "$lib/components/mix/insights/NutrientRadarChart/config";

const nutrientRadarChartStyles = readFileSync(
	"src/lib/components/mix/insights/NutrientRadarChart/NutrientRadarChart.scss",
	"utf8",
);

describe("NutrientRadarChart", () => {
	it("renders the configured goal as one visible dotted outline", () => {
		const { container } = render(NutrientRadarChart, {
			props: {
				nutrientAxisCount: 4,
				actualGoalRatios: [0.6, 0.8, 0.4, 1],
				targetGoalRatios: [1, 0.75, 0.5, 0.9],
				nutrientLabels: ["Calories", "Protein", "Fiber", "Fat"],
			},
		});

		const targetOutline = container.querySelector(".nutrient-radar-chart__goal-shape");

		expect(container.querySelectorAll(".nutrient-radar-chart__goal-shape")).toHaveLength(
			1,
		);
		expect(targetOutline).toHaveAttribute("fill", "none");
		expect(targetOutline).toHaveAttribute("stroke-dasharray", "1 6");
		expect(targetOutline).toHaveAttribute("stroke-linecap", "round");
		expect(
			container.querySelector(".nutrient-radar-chart__goal"),
		).not.toBeInTheDocument();
	});

	it("keeps dense side labels outside the chart while preserving exact values", () => {
		const nutrientLabels = [
			"Calories",
			"Fat",
			"Carbohydrates",
			"Dietary Fiber",
			"Sugars",
			"Protein",
			"Potassium",
		];
		const nutrientValueLabels = [
			"409/350kcal",
			"23/15g",
			"61/61g",
			"2.5/10g",
			"25/25g",
			"25/25g",
			"900/900mg",
		];
		const { container } = render(NutrientRadarChart, {
			props: {
				nutrientAxisCount: nutrientLabels.length,
				actualGoalRatios: nutrientLabels.map(() => 0.75),
				nutrientLabels,
				nutrientValueLabels,
			},
		});

		const chartLabels = Array.from(
			container.querySelectorAll<SVGTextElement>(".nutrient-radar-chart__label"),
		);

		expect(chartLabels).toHaveLength(nutrientLabels.length);
		expect(chartLabels[0]).toHaveTextContent("Carbohydrates");
		expect(chartLabels[1]).toHaveAttribute("text-anchor", "start");
		expect(chartLabels[2]).toHaveAttribute("text-anchor", "start");
		expect(chartLabels[5]).toHaveAttribute("text-anchor", "end");
		expect(chartLabels[6]).toHaveAttribute("text-anchor", "end");
		expect(
			[chartLabels[2].textContent, chartLabels[5].textContent].join(" "),
		).toContain("Sugars");
		expect(
			[chartLabels[2].textContent, chartLabels[5].textContent].join(" "),
		).toContain("Fat");
		expect(
			container.querySelectorAll(".nutrient-radar-chart__value-label"),
		).toHaveLength(nutrientValueLabels.length);
		expect(container.querySelector("svg")).toHaveAccessibleName(
			expect.stringContaining("Dietary Fiber: 2.5/10g"),
		);
	});

	it("assigns the longest nutrient labels to the widest vertical slots", () => {
		const nutrientLabels = [
			"Calories",
			"Fat",
			"Carbohydrates",
			"Dietary Fiber",
			"Sugars",
			"Protein",
			"Potassium",
		];
		const axisOrder = getNutrientRadarChartAxisOrder(nutrientLabels, nutrientLabels.length);
		const displayedLabels = axisOrder.map((sourceIndex) => nutrientLabels[sourceIndex]);

		expect(displayedLabels[0]).toBe("Carbohydrates");
		expect(displayedLabels.slice(2, 6)).not.toContain("Carbohydrates");
		expect([
			displayedLabels[0],
			displayedLabels[3],
			displayedLabels[4],
		]).toEqual(
			expect.arrayContaining(["Carbohydrates", "Dietary Fiber", "Potassium"]),
		);
		expect([displayedLabels[2], displayedLabels[5]]).toEqual(
			expect.arrayContaining(["Sugars", "Fat"]),
		);
	});

	it("keeps values, goals, and colors attached when axes move", () => {
		const nutrientLabels = ["Fat", "Carbohydrates", "Fiber", "Protein"];
		const { container } = render(NutrientRadarChart, {
			props: {
				nutrientAxisCount: nutrientLabels.length,
				nutrientLabels,
				actualGoalRatios: [0.1, 0.2, 0.3, 0.4],
				targetGoalRatios: [0.5, 0.6, 0.7, 0.8],
				nutrientValueLabels: [
					"fat-value",
					"carb-value",
					"fiber-value",
					"protein-value",
				],
				nutrientAxisColors: [
					{ fill: "fat-fill", stroke: "fat-stroke" },
					{ fill: "carb-fill", stroke: "carb-stroke" },
					{ fill: "fiber-fill", stroke: "fiber-stroke" },
					{ fill: "protein-fill", stroke: "protein-stroke" },
				],
			},
		});
		const chartLabels = Array.from(
			container.querySelectorAll<SVGTextElement>(".nutrient-radar-chart__label"),
		);

		expect(chartLabels[0]).toHaveTextContent("Carbohydrates");
		expect(chartLabels[0]).toHaveTextContent("carb-value");
		expect(container.querySelector("linearGradient stop")).toHaveAttribute(
			"stop-color",
			"carb-stroke",
		);
		expect(container.querySelector(".nutrient-radar-chart__goal-shape")).toHaveAttribute(
			"points",
			expect.stringContaining("225.00,149.40"),
		);
	});

	it("can keep exact values accessible without repeating them visually", () => {
		const { container } = render(NutrientRadarChart, {
			props: {
				nutrientAxisCount: 3,
				nutrientLabels: ["Calories", "Protein", "Fiber"],
				actualGoalRatios: [0.8, 1, 0.5],
				nutrientValueLabels: ["280/350kcal", "25/25g", "5/10g"],
				showValueLabels: false,
			},
		});

		expect(
			container.querySelectorAll(".nutrient-radar-chart__value-label"),
		).toHaveLength(0);
		expect(container.querySelector("svg")).toHaveAccessibleName(
			expect.stringContaining("Calories: 280/350kcal"),
		);
	});

	it("hides tiny value rows at the shared compact breakpoints", () => {
		expect(nutrientRadarChartStyles).toMatch(
			/@media \(max-width: \$app-breakpoint-xs\),\s+\(max-height: \$app-breakpoint-height-compact\)/,
		);
		expect(nutrientRadarChartStyles).toMatch(
			/\.nutrient-radar-chart__value-label\s*\{\s*display:\s*none;/,
		);
	});
});
