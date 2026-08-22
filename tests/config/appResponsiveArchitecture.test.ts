import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readStyles = (path: string) => readFileSync(path, "utf8");

describe("app-wide responsive architecture", () => {
	it("defines one shared width and compact-height contract", () => {
		const variables = readStyles("src/styles/_variables.scss");
		const rules = readStyles("docs/dev-rules/dev-rules.md");
		const styleGuide = readStyles("docs/style-guide.md");

		expect(variables).toContain("$app-breakpoint-xs: 420px");
		expect(variables).toContain("$app-breakpoint-sm: 520px");
		expect(variables).toContain("$app-breakpoint-md: 680px");
		expect(variables).toContain("$app-breakpoint-height-compact: 700px");
		expect(rules).toContain("Apply the shared responsive system to the");
		expect(styleGuide).toContain("### App-Wide Responsive Contract");
	});

	it("keeps the authenticated shell synchronized with compact fixed chrome", () => {
		const app = readStyles("src/app.scss");
		const sheets = readStyles(
			"src/lib/components/common/sheets/SheetBase/SheetBase.scss",
		);

		expect(app).toContain("width: min(100%, $app-max-width)");
		expect(app).toContain("$app-shell-header-height-compact");
		expect(app).toContain("$app-shell-nav-height-compact");
		expect(app).toContain("env(safe-area-inset-bottom)");
		expect(sheets).toContain("--sheet-top-offset: #{$app-shell-header-height-compact}");
		expect(sheets).toContain("$app-shell-nav-height-compact");
		expect(sheets).toContain("100dvh");
	});

	it("bounds shared overlays to the usable viewport", () => {
		const confirmation = readStyles(
			"src/lib/components/common/dialogs/ConfirmationDialog/ConfirmationDialog.scss",
		);
		const popover = readStyles(
			"src/lib/components/common/display/Popover/Popover.scss",
		);
		const tutorial = readStyles(
			"src/lib/components/app/TutorialOverlay/TutorialOverlay.scss",
		);
		const scanner = readStyles(
			"src/lib/components/ingredients/barcode/BarcodeScannerDialog/BarcodeScannerDialog.scss",
		);

		for (const styles of [confirmation, popover, tutorial, scanner]) {
			expect(styles).toContain("100dvh");
		}
		expect(confirmation).toContain("grid-template-columns: 1fr");
		expect(popover).toContain("overflow-y: auto");
		expect(tutorial).toContain("$app-breakpoint-height-compact");
		expect(scanner).toContain("env(safe-area-inset-bottom)");
		expect(
			readStyles("src/lib/components/common/sheets/SheetBase/SheetBase.scss"),
		).toContain("min-height: 0");
	});

	it("applies compact behavior to shared controls and every primary route", () => {
		const files = [
			"src/app.scss",
			"src/lib/components/app/TutorialOverlay/TutorialOverlay.scss",
			"src/lib/components/common/actions/PrivilegedActionGroup/PrivilegedActionGroup.scss",
			"src/lib/components/common/buttons/ActionButton/ActionButton.scss",
			"src/lib/components/common/buttons/RoundedActionButton/RoundedActionButton.scss",
			"src/lib/components/common/buttons/IconControlButton/IconControlButton.scss",
			"src/lib/components/common/dialogs/ConfirmationDialog/ConfirmationDialog.scss",
			"src/lib/components/common/dialogs/TextInputDialog/TextInputDialog.scss",
			"src/lib/components/common/disclosure/CollapsibleSection/CollapsibleSection.scss",
			"src/lib/components/common/display/MetadataPill/MetadataPill.scss",
			"src/lib/components/common/display/Popover/Popover.scss",
			"src/lib/components/common/feedback/StatusMessage/StatusMessage.scss",
			"src/lib/components/common/forms/CheckboxGroup/CheckboxGroup.scss",
			"src/lib/components/common/forms/PhotoUploadInput/PhotoUploadInput.scss",
			"src/lib/components/common/images/ImagePlacementEditor/ImagePlacementEditor.scss",
			"src/lib/components/common/sheets/BottomSheet/BottomSheet.scss",
			"src/lib/components/common/sheets/BottomSheetAction/BottomSheetAction.scss",
			"src/lib/components/common/sheets/SheetBase/SheetBase.scss",
			"src/routes/page.scss",
			"src/routes/auth/page.scss",
			"src/routes/auth/update-password/page.scss",
			"src/routes/mix/page.scss",
			"src/routes/saved/page.scss",
			"src/routes/profile/page.scss",
			"src/lib/components/moderation/ModerationWorkspace/ModerationWorkspace.scss",
		];

		for (const file of files) {
			const styles = readStyles(file);
			expect(styles, file).toContain("$app-breakpoint");
		}
	});
});
