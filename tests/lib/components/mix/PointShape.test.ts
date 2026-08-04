import { render } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import PointShape from "$lib/components/mix/insights/PointShape/PointShape.svelte";
import { getPointShapeAxisOrder } from "$lib/components/mix/insights/PointShape/config";

const pointShapeStyles = readFileSync(
	"src/lib/components/mix/insights/PointShape/PointShape.scss",
	"utf8",
);

describe("PointShape", () => {
	it("renders the configured goal as one visible dotted outline", () => {
		const { container } = render(PointShape, {
			props: {
				points: 4,
				values: [0.6, 0.8, 0.4, 1],
				goalValues: [1, 0.75, 0.5, 0.9],
				labels: ["Calories", "Protein", "Fiber", "Fat"],
			},
		});

		const goalShape = container.querySelector(".point-shape__goal-shape");

		expect(container.querySelectorAll(".point-shape__goal-shape")).toHaveLength(1);
		expect(goalShape).toHaveAttribute("fill", "none");
		expect(goalShape).toHaveAttribute("stroke-dasharray", "1 6");
		expect(goalShape).toHaveAttribute("stroke-linecap", "round");
		expect(container.querySelector(".point-shape__goal")).not.toBeInTheDocument();
	});

	it("keeps dense side labels outside the chart while preserving exact values", () => {
		const labels = [
			"Calories",
			"Fat",
			"Carbohydrates",
			"Dietary Fiber",
			"Sugars",
			"Protein",
			"Potassium",
		];
		const valueLabels = [
			"409/350kcal",
			"23/15g",
			"61/61g",
			"2.5/10g",
			"25/25g",
			"25/25g",
			"900/900mg",
		];
		const { container } = render(PointShape, {
			props: {
				points: labels.length,
				values: labels.map(() => 0.75),
				labels,
				valueLabels,
			},
		});

		const chartLabels = Array.from(
			container.querySelectorAll<SVGTextElement>(".point-shape__label"),
		);

		expect(chartLabels).toHaveLength(labels.length);
		expect(chartLabels[0]).toHaveTextContent("Carbohydrates");
		expect(chartLabels[1]).toHaveAttribute("text-anchor", "start");
		expect(chartLabels[2]).toHaveAttribute("text-anchor", "start");
		expect(chartLabels[5]).toHaveAttribute("text-anchor", "end");
		expect(chartLabels[6]).toHaveAttribute("text-anchor", "end");
		expect([chartLabels[2].textContent, chartLabels[5].textContent].join(" ")).toContain(
			"Sugars",
		);
		expect([chartLabels[2].textContent, chartLabels[5].textContent].join(" ")).toContain(
			"Fat",
		);
		expect(container.querySelectorAll(".point-shape__value-label")).toHaveLength(
			valueLabels.length,
		);
		expect(container.querySelector("svg")).toHaveAccessibleName(
			expect.stringContaining("Dietary Fiber: 2.5/10g"),
		);
	});

	it("assigns the longest nutrient labels to the widest vertical slots", () => {
		const labels = [
			"Calories",
			"Fat",
			"Carbohydrates",
			"Dietary Fiber",
			"Sugars",
			"Protein",
			"Potassium",
		];
		const axisOrder = getPointShapeAxisOrder(labels, labels.length);
		const displayedLabels = axisOrder.map((sourceIndex) => labels[sourceIndex]);

		expect(displayedLabels[0]).toBe("Carbohydrates");
		expect(displayedLabels.slice(2, 6)).not.toContain("Carbohydrates");
		expect([displayedLabels[0], displayedLabels[3], displayedLabels[4]]).toEqual(
			expect.arrayContaining(["Carbohydrates", "Dietary Fiber", "Potassium"]),
		);
		expect([displayedLabels[2], displayedLabels[5]]).toEqual(
			expect.arrayContaining(["Sugars", "Fat"]),
		);
	});

	it("keeps values, goals, and colors attached when axes move", () => {
		const labels = ["Fat", "Carbohydrates", "Fiber", "Protein"];
		const { container } = render(PointShape, {
			props: {
				points: labels.length,
				labels,
				values: [0.1, 0.2, 0.3, 0.4],
				goalValues: [0.5, 0.6, 0.7, 0.8],
				valueLabels: ["fat-value", "carb-value", "fiber-value", "protein-value"],
				pointColors: [
					{ fill: "fat-fill", stroke: "fat-stroke" },
					{ fill: "carb-fill", stroke: "carb-stroke" },
					{ fill: "fiber-fill", stroke: "fiber-stroke" },
					{ fill: "protein-fill", stroke: "protein-stroke" },
				],
			},
		});
		const chartLabels = Array.from(
			container.querySelectorAll<SVGTextElement>(".point-shape__label"),
		);

		expect(chartLabels[0]).toHaveTextContent("Carbohydrates");
		expect(chartLabels[0]).toHaveTextContent("carb-value");
		expect(container.querySelector("linearGradient stop")).toHaveAttribute(
			"stop-color",
			"carb-stroke",
		);
		expect(container.querySelector(".point-shape__goal-shape")).toHaveAttribute(
			"points",
			expect.stringContaining("225.00,149.40"),
		);
	});

	it("hides tiny value rows at the shared compact breakpoints", () => {
		expect(pointShapeStyles).toContain(
			"@media (max-width: $app-breakpoint-xs), (max-height: $app-breakpoint-height-compact)",
		);
		expect(pointShapeStyles).toMatch(
			/\.point-shape__value-label\s*\{\s*display:\s*none;/,
		);
	});
});
