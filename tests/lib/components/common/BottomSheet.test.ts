import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const componentPath = resolve(
	process.cwd(),
	"src/lib/components/common/sheets/BottomSheet.svelte",
);
const manualEntrySheetPath = resolve(
	process.cwd(),
	"src/lib/components/ingredients/sheets/ManualEntrySheet.svelte",
);
const manualEntryFormPath = resolve(
	process.cwd(),
	"src/lib/components/ingredients/manual-entry/CustomIngredientForm.svelte",
);

describe("BottomSheet shared chrome", () => {
	it("keeps the drag handle horizontally centered", () => {
		const source = readFileSync(componentPath, "utf8");
		const handleRule = source.match(/\.bottom-sheet__handle\s*{(?<body>[^}]*)}/s);

		expect(handleRule?.groups?.body).toContain("justify-self: center;");
		expect(handleRule?.groups?.body).toContain("place-items: center;");
	});

	it("allows a flow to hide the shared back control", () => {
		const source = readFileSync(componentPath, "utf8");
		const manualEntrySource = readFileSync(manualEntrySheetPath, "utf8");

		expect(source).toContain("showBack = true");
		expect(source).toContain("{#if showBack}");
		expect(manualEntrySource).toContain("showBack={false}");
	});

	it("closes manual entry once before forwarding a successful creation", () => {
		const manualEntrySource = readFileSync(manualEntrySheetPath, "utf8");
		const manualEntryFormSource = readFileSync(manualEntryFormPath, "utf8");
		const completionHandler = manualEntrySource.match(
			/const handleCreate[\s\S]*?\n\t};/,
		)?.[0];
		const useIngredient = manualEntryFormSource.match(
			/const useIngredient[\s\S]*?\n\t};/,
		)?.[0];

		expect(completionHandler).toContain("onClose();");
		expect(completionHandler).toContain("await onCreate(food, context);");
		expect(completionHandler?.indexOf("onClose();")).toBeLessThan(
			completionHandler?.indexOf("await onCreate(food, context);") ?? -1,
		);
		expect(useIngredient).not.toContain("onClose?.()");
	});
});
