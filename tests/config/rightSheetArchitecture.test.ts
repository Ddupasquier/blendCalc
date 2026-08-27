import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(path, "utf8");

describe("right-sheet architecture", () => {
	it("uses RightSheet as the only shared right-placement shell", () => {
		const rightSheet = readSource(
			"src/lib/components/common/sheets/RightSheet/RightSheet.svelte",
		);
		const ingredientRoutePopins = readSource(
			"src/lib/components/ingredients/page/IngredientRoutePopins/IngredientRoutePopins.svelte",
		);
		const profilePage = readSource("src/routes/profile/+page.svelte");
		const privilegedToolRightSheet = readSource(
			"src/lib/components/moderation/PrivilegedToolRightSheet/PrivilegedToolRightSheet.svelte",
		);

		expect(rightSheet).toContain("<SheetBase");
		expect(rightSheet).toContain('placement="right"');
		expect(rightSheet).toContain("modal={false}");
		expect(rightSheet).toContain("backdrop={false}");
		expect(ingredientRoutePopins.match(/<RightSheet/g)).toHaveLength(2);
		expect(profilePage).toContain("<RightSheet");
		expect(privilegedToolRightSheet).toContain("<RightSheet");
	});
});
