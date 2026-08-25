import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(path, "utf8");

describe("saved ingredient move animation", () => {
	it("reflows keyed cards with Svelte motion and honors reduced-motion preferences", () => {
		const savedList = readSource(
			"src/lib/components/ingredients/list/SavedIngredientList/SavedIngredientList.svelte",
		);

		expect(savedList).toContain('import { flip } from "svelte/animate"');
		expect(savedList).toContain("animate:flip");
		expect(savedList).toContain(
			"getMotionSafeDuration(MOTION_DURATION_MS.reflow)",
		);
	});

	it("reconciles successful moves locally instead of refreshing both lists", () => {
		const fridgePage = readSource("src/routes/ingredients/fridge/+page.svelte");
		const singleMoveStart = fridgePage.indexOf(
			"const moveFoodBetweenLists = async",
		);
		const bulkMoveStart = fridgePage.indexOf(
			"const moveSelectedItems = async",
			singleMoveStart,
		);
		const actionSheetStart = fridgePage.indexOf(
			"const openActionSheet",
			bulkMoveStart,
		);
		const singleMoveWorkflow = fridgePage.slice(singleMoveStart, bulkMoveStart);
		const bulkMoveWorkflow = fridgePage.slice(bulkMoveStart, actionSheetStart);

		expect(singleMoveWorkflow).toContain("notify: false");
		expect(bulkMoveWorkflow).toContain("notify: false");
		expect(singleMoveWorkflow).toContain(
			"applyBulkListMove(sourceKey, [food])",
		);
		expect(singleMoveWorkflow).not.toContain("await loadLists()");
		expect(bulkMoveWorkflow).toContain(
			"applyBulkListMove(sourceKey, selectedFoods)",
		);
		expect(bulkMoveWorkflow).not.toContain("await loadLists()");
	});

	it("renders both ingredient destinations through one shared list path", () => {
		const fridgePage = readSource("src/routes/ingredients/fridge/+page.svelte");

		expect(fridgePage.match(/<SavedIngredientList\b/g)).toHaveLength(1);
		expect(fridgePage).toContain("foods={activeVisibleList}");
		expect(fridgePage).toContain(
			"onMoveItem={(food) => moveFoodBetweenLists(activeList, food)}",
		);
		expect(fridgePage).toContain(
			"onRemove={(foodId) => removeFromList(activeList, foodId)}",
		);
	});
});
