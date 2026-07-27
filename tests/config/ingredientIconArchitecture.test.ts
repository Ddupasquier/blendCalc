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
			"src/lib/components/ingredients/barcode/BarcodeScannerIcon/BarcodeScannerIcon.svelte",
		]);
		expect(basename(inlineSvgFiles[0])).toMatch(/Icon\.svelte$/);
	});

	it("uses one directional chevron component throughout Ingredients", () => {
		const componentSource = ingredientViewFiles
			.map((file) => readFileSync(file, "utf8"))
			.join("\n");

		expect(componentSource).not.toMatch(/ChevronDown|ChevronRight|ArrowLeft/);
		expect(componentSource).not.toMatch(/content:\s*["'](?:⌄|⌃|›|‹)["']/);
		expect(componentSource).toContain("$lib/assets/icons/Chevron/Chevron.svelte");
	});

	it("uses shared circular frames for non-interactive ingredient icons", () => {
		const manualEntryToggle = readFileSync(
			"src/lib/components/ingredients/manual-entry/ManualEntryToggle/ManualEntryToggle.svelte",
			"utf8",
		);
		const emptyState = readFileSync(
			"src/lib/components/ingredients/list/IngredientEmptyState/IngredientEmptyState.svelte",
			"utf8",
		);
		const bottomSheetAction = readFileSync(
			"src/lib/components/common/sheets/BottomSheetAction/BottomSheetAction.svelte",
			"utf8",
		);

		expect(manualEntryToggle).toContain("<CircularIconFrame");
		expect(emptyState).toContain("<CircularIconFrame");
		expect(bottomSheetAction).toContain("<CircularIconFrame");
	});

	it("keeps circular icon centering inside shared primitives", () => {
		const centeredIconComponent = readFileSync(
			"src/lib/components/common/icons/CenteredIcon/CenteredIcon.svelte",
			"utf8",
		);
		const centeredIconStyles = readFileSync(
			"src/lib/components/common/icons/CenteredIcon/CenteredIcon.scss",
			"utf8",
		);
		const circularIconFrameComponent = readFileSync(
			"src/lib/components/common/icons/CircularIconFrame/CircularIconFrame.svelte",
			"utf8",
		);
		const circularIconFrameStyles = readFileSync(
			"src/lib/components/common/icons/CircularIconFrame/CircularIconFrame.scss",
			"utf8",
		);
		const circularMediaFrameStyles = readFileSync(
			"src/lib/components/common/images/CircularMediaFrame/CircularMediaFrame.scss",
			"utf8",
		);
		const circleIconButtonStyles = readFileSync(
			"src/lib/components/common/buttons/CircleIconButton/CircleIconButton.scss",
			"utf8",
		);
		const iconControlButtonStyles = readFileSync(
			"src/lib/components/common/buttons/IconControlButton/IconControlButton.scss",
			"utf8",
		);
		const closeButtonStyles = readFileSync(
			"src/lib/components/common/buttons/CloseButton/CloseButton.scss",
			"utf8",
		);
		const actionButtonComponent = readFileSync(
			"src/lib/components/common/buttons/ActionButton/ActionButton.svelte",
			"utf8",
		);
		const statusBadge = readFileSync(
			"src/lib/components/common/badges/StatusIconBadge/StatusIconBadge.svelte",
			"utf8",
		);
		const statusBadgeStyles = readFileSync(
			"src/lib/components/common/badges/StatusIconBadge/StatusIconBadge.scss",
			"utf8",
		);
		const verifiedStatusBadge = readFileSync(
			"src/lib/components/common/badges/VerifiedStatusBadge/VerifiedStatusBadge.svelte",
			"utf8",
		);
		const verifiedStatusBadgeStyles = readFileSync(
			"src/lib/components/common/badges/VerifiedStatusBadge/VerifiedStatusBadge.scss",
			"utf8",
		);
		const privilegedBadge = readFileSync(
			"src/lib/components/common/badges/PrivilegedActionBadge/PrivilegedActionBadge.svelte",
			"utf8",
		);
		const privilegedBadgeStyles = readFileSync(
			"src/lib/components/common/badges/PrivilegedActionBadge/PrivilegedActionBadge.scss",
			"utf8",
		);

		expect(centeredIconComponent).toContain('@use "./CenteredIcon.scss"');
		expect(centeredIconStyles).toContain("display: inline-flex");
		expect(centeredIconStyles).toContain("align-items: center");
		expect(centeredIconStyles).toContain("justify-content: center");
		expect(centeredIconStyles).not.toContain("transform:");
		expect(centeredIconStyles).not.toContain("optical-offset");
		expect(centeredIconStyles).toContain("width: 100%");
		expect(centeredIconStyles).toContain("height: 100%");
		expect(circularIconFrameComponent).toContain('@use "./CircularIconFrame.scss"');
		expect(circularIconFrameStyles).toContain("overflow: hidden");
		expect(circularIconFrameStyles).toContain("align-items: center");
		expect(circularIconFrameStyles).toContain("justify-content: center");
		expect(circularIconFrameStyles).toContain(
			"var(--circular-icon-frame-icon-transform, none)",
		);
		for (const sharedContainerStyles of [
			circularMediaFrameStyles,
			circleIconButtonStyles,
			iconControlButtonStyles,
			closeButtonStyles,
		]) {
			expect(sharedContainerStyles).toContain("align-items: center");
			expect(sharedContainerStyles).toContain("justify-content: center");
		}
		expect(statusBadge).not.toContain("centered-icon-optical-offset");
		expect(statusBadgeStyles).toContain(
			"--circular-icon-frame-icon-transform",
		);
		expect(verifiedStatusBadge).toContain(
			'@use "./VerifiedStatusBadge.scss"',
		);
		expect(verifiedStatusBadgeStyles).toContain(
			"--circular-icon-frame-icon-transform",
		);
		expect(actionButtonComponent).toContain(
			'<CenteredIcon class="action-button__icon">',
		);
		expect(privilegedBadge).toContain("<CenteredIcon>");
		expect(privilegedBadge).not.toContain("<CircularIconFrame");
		expect(privilegedBadgeStyles).toContain("color: $app-highlight");
	});

	it("isolates move-chevron optical alignment from shared chevrons", () => {
		const savedIngredientCard = readFileSync(
			"src/lib/components/ingredients/list/SavedIngredientCard/SavedIngredientCard.svelte",
			"utf8",
		);
		const moveIconComponent = readFileSync(
			"src/lib/components/ingredients/list/IngredientMoveIcon/IngredientMoveIcon.svelte",
			"utf8",
		);
		const moveIconStyles = readFileSync(
			"src/lib/components/ingredients/list/IngredientMoveIcon/IngredientMoveIcon.scss",
			"utf8",
		);

		expect(savedIngredientCard).toContain("<IngredientMoveIcon");
		expect(savedIngredientCard).not.toContain("<Chevron");
		expect(moveIconComponent).toContain("<Chevron {direction} />");
		expect(moveIconStyles).toContain("align-items: center");
		expect(moveIconStyles).toContain("justify-content: center");
		expect(moveIconStyles).toContain('data-direction="left"');
		expect(moveIconStyles).toContain('data-direction="right"');
	});
});
