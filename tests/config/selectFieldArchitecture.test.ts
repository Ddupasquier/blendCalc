import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const collectSvelteFiles = (directory: string): string[] =>
	readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) return collectSvelteFiles(path);
		return entry.isFile() && entry.name.endsWith(".svelte") ? [path] : [];
	});

describe("select field architecture", () => {
	it("keeps fixed-choice form semantics and custom listbox markup inside the shared primitive", () => {
		const nativeSelectOwners = collectSvelteFiles("src")
			.filter((path) => /<select\b/.test(readFileSync(path, "utf8")))
			.map((path) => relative(".", path));

		expect(nativeSelectOwners).toEqual([
			"src/lib/components/common/forms/SelectField/SelectField.svelte",
		]);

		const primitive = readFileSync(nativeSelectOwners[0], "utf8");
		expect(primitive).toContain('role="combobox"');
		expect(primitive).toContain('role="listbox"');
		expect(primitive).toContain(
			'popover={popoverSupported ? "manual" : undefined}',
		);
	});

	it("documents the primitive and preserves specialized searchable pickers", () => {
		const styleGuide = readFileSync("docs/development/style-guide.md", "utf8");

		expect(styleGuide).toContain("| Fixed-choice dropdown");
		expect(styleGuide).toContain("`SelectField`");
		expect(styleGuide).toContain("`FoodCategoryPicker`");
		expect(styleGuide).toContain("`SearchDropdown`");
	});
});
