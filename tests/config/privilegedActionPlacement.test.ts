import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("privileged action crown placement", () => {
	it("keeps crowns out of individual shared controls", () => {
		const controlFiles = [
			"src/lib/components/common/buttons/PillButton/PillButton.svelte",
			"src/lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte",
			"src/lib/components/common/images/ImagePlacementEditor/ImagePlacementEditor.svelte",
			"src/lib/components/common/sheets/BottomSheetAction/BottomSheetAction.svelte",
		];

		for (const file of controlFiles) {
			const source = read(file);
			expect(source).not.toContain("PrivilegedActionBadge");
			expect(source).not.toContain("privileged");
		}
	});

	it("marks privileged containers instead of every child action", () => {
		const imagePanel = read(
			"src/lib/components/ingredients/nutrition/ProductImagePanel/ProductImagePanel.svelte",
		);
		const actionSheet = read(
			"src/lib/components/ingredients/sheets/IngredientActionSheet/IngredientActionSheet.svelte",
		);

		expect(imagePanel).not.toContain("PrivilegedActionBadge");
		expect(imagePanel).not.toContain("PrivilegedActionGroup");
		const moderatorEditor = read(
			"src/lib/components/moderation/ImagePlacementReviewEditor/ImagePlacementReviewEditor.svelte",
		);
		expect(moderatorEditor).toContain(
			'<PrivilegedActionGroup title="Shared image adjustment" showHeader={false}>',
		);
		expect(actionSheet).not.toContain("PrivilegedActionGroup");
		expect(actionSheet).not.toContain("privileged");
	});
});
