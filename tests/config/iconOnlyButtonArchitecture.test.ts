import { globSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const clusteredControlConsumers = [
	"src/lib/components/common/lists/ListControls/ListControls.svelte",
	"src/lib/components/ingredients/page/IngredientsSearchPanel/IngredientsSearchPanel.svelte",
	"src/lib/components/ingredients/search/IngredientSearchView/IngredientSearchView.svelte",
];

describe("icon-only button architecture", () => {
	it("reserves squarish icon controls for deliberate horizontal control clusters", () => {
		const actualConsumers = globSync("src/**/*.svelte")
			.filter(
				(path) =>
					path !==
					"src/lib/components/common/buttons/IconControlButton/IconControlButton.svelte",
			)
			.filter((path) => readFileSync(path, "utf8").includes("IconControlButton"))
			.sort();

		expect(actualConsumers).toEqual([...clusteredControlConsumers].sort());

		for (const path of [
			"src/lib/components/mix/layout/MixHeader/MixHeader.svelte",
			"src/lib/components/mix/controls/GoalTargets/GoalTargets.svelte",
			"src/lib/components/mix/ingredients/IngredientCard/IngredientCard.svelte",
		]) {
			const source = readFileSync(path, "utf8");
			expect(source, path).toContain("CircleIconButton");
			expect(source, path).not.toContain("IconControlButton");
		}
	});

	it("keeps every CircleIconButton size circular without feature-local shape overrides", () => {
		const styles = readFileSync(
			"src/lib/components/common/buttons/CircleIconButton/CircleIconButton.scss",
			"utf8",
		);
		const mixHeaderStyles = readFileSync(
			"src/lib/components/mix/layout/MixHeader/MixHeader.scss",
			"utf8",
		);

		expect(styles).toContain("border-radius: $app-radius-circle");
		expect(styles).not.toMatch(
			/\.circle-icon-button\[data-size="fab"\][\s\S]*?border-radius/,
		);
		expect(mixHeaderStyles).not.toMatch(/icon-control-button|border-radius:\s*50%/);
	});
});
