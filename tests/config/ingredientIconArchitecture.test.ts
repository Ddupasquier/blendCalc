import { readFileSync, readdirSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ingredientComponentRoot = "src/lib/components/ingredients";
const ingredientRouteRoot = "src/routes/fridge";

const collectSvelteFiles = (directory: string): string[] =>
	readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) return collectSvelteFiles(path);
		return entry.isFile() && entry.name.endsWith(".svelte") ? [path] : [];
	});

const ingredientViewFiles = [
	...collectSvelteFiles(ingredientComponentRoot),
	...collectSvelteFiles(ingredientRouteRoot),
];

describe("ingredient icon architecture", () => {
	it("keeps feature SVG markup inside explicitly reusable icon components", () => {
		const inlineSvgFiles = ingredientViewFiles
			.filter((file) => readFileSync(file, "utf8").includes("<svg"))
			.map((file) => relative(".", file));

		expect(inlineSvgFiles).toEqual([
			"src/lib/components/ingredients/barcode/BarcodeScannerIcon.svelte",
		]);
		expect(basename(inlineSvgFiles[0])).toMatch(/Icon\.svelte$/);
	});

	it("uses one directional chevron component throughout Ingredients", () => {
		const componentSource = ingredientViewFiles
			.map((file) => readFileSync(file, "utf8"))
			.join("\n");

		expect(componentSource).not.toMatch(/ChevronDown|ChevronRight|ArrowLeft/);
		expect(componentSource).not.toMatch(/content:\s*["'](?:⌄|⌃|›|‹)["']/);
		expect(componentSource).toContain("$lib/assets/icons/Chevron.svelte");
	});

	it("uses shared circular frames for non-interactive ingredient icons", () => {
		const manualEntryToggle = readFileSync(
			"src/lib/components/ingredients/manual-entry/ManualEntryToggle.svelte",
			"utf8",
		);
		const emptyState = readFileSync(
			"src/lib/components/ingredients/list/IngredientEmptyState.svelte",
			"utf8",
		);
		const bottomSheetAction = readFileSync(
			"src/lib/components/common/sheets/BottomSheetAction.svelte",
			"utf8",
		);

		expect(manualEntryToggle).toContain("<CircularIconFrame");
		expect(emptyState).toContain("<CircularIconFrame");
		expect(bottomSheetAction).toContain("<CircularIconFrame");
	});

	it("keeps circular icon centering inside shared primitives", () => {
		const centeredIcon = readFileSync(
			"src/lib/components/common/icons/CenteredIcon.svelte",
			"utf8",
		);
		const circularIconFrame = readFileSync(
			"src/lib/components/common/icons/CircularIconFrame.svelte",
			"utf8",
		);
		const statusBadge = readFileSync(
			"src/lib/components/common/badges/StatusIconBadge.svelte",
			"utf8",
		);
		const privilegedBadge = readFileSync(
			"src/lib/components/common/badges/PrivilegedActionBadge.svelte",
			"utf8",
		);

		expect(centeredIcon).toContain("--centered-icon-optical-offset-y");
		expect(centeredIcon).toContain("place-items: center");
		expect(centeredIcon).toContain("width: 100%");
		expect(centeredIcon).toContain("height: 100%");
		expect(circularIconFrame).toContain("overflow: hidden");
		expect(circularIconFrame).toContain("place-items: center");
		expect(statusBadge).not.toContain("centered-icon-optical-offset");
		expect(privilegedBadge).toContain("<CenteredIcon>");
		expect(privilegedBadge).not.toContain("<CircularIconFrame");
		expect(privilegedBadge).toContain("$app-privileged-badge-color");
	});
});
