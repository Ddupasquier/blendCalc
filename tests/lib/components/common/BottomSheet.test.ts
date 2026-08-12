import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const componentPath = resolve(
	process.cwd(),
	"src/lib/components/common/sheets/BottomSheet/BottomSheet.svelte",
);
const componentStylesPath = resolve(
	process.cwd(),
	"src/lib/components/common/sheets/BottomSheet/BottomSheet.scss",
);
const manualEntrySheetPath = resolve(
	process.cwd(),
	"src/lib/components/ingredients/sheets/ManualEntrySheet/ManualEntrySheet.svelte",
);
const manualEntryOutcomeControllerPath = resolve(
	process.cwd(),
	"src/lib/components/ingredients/manual-entry/CustomIngredientForm/manualEntryOutcomeController.svelte.ts",
);

describe("BottomSheet shared chrome", () => {
	it("keeps the drag handle horizontally centered", () => {
		const source = readFileSync(componentStylesPath, "utf8");
		const handleRule = source.match(/\.bottom-sheet__handle\s*{(?<body>[^}]*)}/s);

		expect(handleRule?.groups?.body).toContain("justify-self: center;");
		expect(handleRule?.groups?.body).toContain("place-items: center;");
	});

	it("keeps the drag handle focus outline visible", () => {
		const source = readFileSync(componentStylesPath, "utf8");
		const sheetRule = source.match(/\.bottom-sheet\s*{(?<body>[\s\S]*?)\n\t}/);
		const focusRule = source.match(/&:focus-visible\s*{(?<body>[^}]*)}/s);

		expect(sheetRule?.groups?.body).toContain("overflow: visible;");
		expect(focusRule?.groups?.body).toContain(
			"outline-offset: $app-focus-outline-offset;",
		);
	});

	it("reserves scroll clearance for focused content without changing alignment", () => {
		const source = readFileSync(componentStylesPath, "utf8");
		const contentRule = source.match(
			/\.bottom-sheet__content\s*{(?<body>[\s\S]*?)\n}/,
		);

		expect(source).toContain(
			"$bottom-sheet-focus-clearance: $app-gap-2xs;",
		);
		expect(contentRule?.groups?.body).toContain(
			"margin-inline: calc(0rem - #{$bottom-sheet-focus-clearance});",
		);
		expect(contentRule?.groups?.body).toContain(
			"padding-inline: $bottom-sheet-focus-clearance;",
		);
		expect(contentRule?.groups?.body).toContain(
			"scroll-padding: $bottom-sheet-focus-clearance;",
		);
	});

	it("does not duplicate close behavior with a back control", () => {
		const source = readFileSync(componentPath, "utf8");
		const manualEntrySource = readFileSync(manualEntrySheetPath, "utf8");

		expect(source).toContain('aria-label="Close sheet"');
		expect(source).not.toContain("BackButton");
		expect(source).not.toContain("showBack");
		expect(source).not.toContain("backLabel");
		expect(manualEntrySource).not.toContain("showBack");
	});

	it("hides manual entry while forwarding successful creation to the routed owner", () => {
		const manualEntrySource = readFileSync(manualEntrySheetPath, "utf8");
		const manualEntryOutcomeSource = readFileSync(
			manualEntryOutcomeControllerPath,
			"utf8",
		);
		const completionHandler = manualEntrySource.match(
			/const handleCreate[\s\S]*?\n\t};/,
		)?.[0];
		const useIngredient = manualEntryOutcomeSource.match(
			/const useIngredient[\s\S]*?\n\t};/,
		)?.[0];

		expect(completionHandler).toContain(
			"closingAfterSuccessfulCreate = true;",
		);
		expect(completionHandler).toContain("clearManualEntryDraft();");
		expect(completionHandler).toContain("await onCreate(food, context);");
		expect(
			completionHandler?.indexOf("closingAfterSuccessfulCreate = true;"),
		).toBeLessThan(
			completionHandler?.indexOf("await onCreate(food, context);") ?? -1,
		);
		expect(completionHandler).not.toContain("onClose()");
		expect(useIngredient).not.toContain("onClose?.()");
	});
});
