import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const variablesPath = "src/styles/_variables.scss";
const variables = readFileSync(variablesPath, "utf8");

describe("SCSS architecture", () => {
	it("keeps global tokens direct and free of obsolete namespaces", () => {
		const definitions = [...variables.matchAll(/^\$([\w-]+):\s*([^;]+);/gm)];

		expect(definitions.length).toBeGreaterThan(0);
		for (const [, name, value] of definitions) {
			expect(name).not.toMatch(/^(color|ingredient|mix|nutrition-label)-/);
			expect(name).not.toContain("rebuild");
			expect(value, `$${name} must point directly to its value`).not.toMatch(/\$[\w-]+/);
		}
	});

	it("does not use retired token namespaces in application styles", () => {
		let output = "";
		try {
			output = execFileSync(
				"rg",
				[
					"-n",
					"\\$(color-|app-rebuild|app-mobile-shell-width|app-vertical-stack-gap|app-horizontal-control-gap|ingredient-|mix-|nutrition-label-)",
					"src",
					"--glob",
					"*.svelte",
					"--glob",
					"*.scss",
				],
				{ encoding: "utf8" },
			);
		} catch (error) {
			const status = (error as { status?: number }).status;
			if (status !== 1) throw error;
		}

		expect(output).toBe("");
	});

	it("pairs non-trivial component styles with their component folders", () => {
		for (const component of [
			"src/lib/components/common/buttons/RoundedActionButton",
			"src/lib/components/common/buttons/ActionButton",
			"src/lib/components/common/buttons/CircleIconButton",
			"src/lib/components/common/buttons/SegmentedControl",
			"src/lib/components/common/feedback/LoadingSpinner",
			"src/lib/components/ingredients/manual-entry/FoodCategoryPicker",
			"src/lib/components/ingredients/manual-entry/NutritionLabelOcrInput",
		]) {
			const name = component.split("/").at(-1);
			expect(readFileSync(`${component}/${name}.svelte`, "utf8")).toContain(
				`@use "./${name}.scss"`,
			);
			expect(readFileSync(`${component}/${name}.scss`, "utf8").length).toBeGreaterThan(0);
		}
	});
});
