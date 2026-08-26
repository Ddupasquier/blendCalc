import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = join(process.cwd(), "src");
const collapsibleStylesPath = join(
	sourceRoot,
	"lib/components/common/disclosure/CollapsibleSection/CollapsibleSection.scss",
);
const collapsibleComponentPath = join(
	sourceRoot,
	"lib/components/common/disclosure/CollapsibleSection/CollapsibleSection.svelte",
);
const disclosureChevronPath = join(
	sourceRoot,
	"lib/components/common/disclosure/DisclosureChevron/DisclosureChevron.svelte",
);
const disclosureChevronStylesPath = join(
	sourceRoot,
	"lib/components/common/disclosure/DisclosureChevron/DisclosureChevron.scss",
);
const specializedDisclosureConsumers = [
	"lib/components/common/disclosure/CollapsibleSection/CollapsibleSection.svelte",
	"lib/components/ingredients/manual-entry/ManualEntryToggle/ManualEntryToggle.svelte",
	"lib/components/ingredients/manual-entry/NutritionLabelOcrInput/NutritionLabelOcrInput.svelte",
	"lib/components/mix/ingredients/MixIngredientAmountCard/MixIngredientAmountCard.svelte",
	"lib/components/saved/SavedRecipeIngredientPills/SavedRecipeIngredientPills.svelte",
];

const getSvelteFiles = (directory: string): string[] =>
	readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) return getSvelteFiles(path);
		return entry.isFile() && entry.name.endsWith(".svelte") ? [path] : [];
	});

describe("collapsible motion architecture", () => {
	it("routes every native details disclosure through the shared animation behavior", () => {
		const unanimatedDetails = getSvelteFiles(sourceRoot).flatMap((path) => {
			const source = readFileSync(path, "utf8");
			return [...source.matchAll(/<details\b[\s\S]*?>/g)]
				.filter(([tag]) => !tag.includes("use:animatedDetails"))
				.map(() => path.slice(process.cwd().length + 1));
		});

		expect(unanimatedDetails).toEqual([]);
	});

	it("prevents disclosure height changes from re-anchoring scroll surfaces", () => {
		const source = readFileSync(collapsibleStylesPath, "utf8");

		expect(source).toMatch(
			/\.collapsible-section\s*\{[^}]*overflow-anchor:\s*none;/s,
		);
	});

	it("rotates the shared chevron from right when closed to down when open", () => {
		const component = readFileSync(collapsibleComponentPath, "utf8");
		const chevron = readFileSync(disclosureChevronPath, "utf8");
		const styles = readFileSync(disclosureChevronStylesPath, "utf8");

		expect(component).toContain("<DisclosureChevron");
		expect(chevron).toContain('<Chevron direction="right"');
		expect(styles).toContain(
			'@use "../../../../utils/animation/motion" as motion;',
		);
		expect(styles).toMatch(
			/\.disclosure-chevron\s*\{[^}]*transition:\s*transform\s+motion\.\$duration-feedback\s+motion\.\$easing-standard;/s,
		);
		expect(styles).toMatch(
			/\[data-expanded="true"\][^}]*summary\)\s*\.disclosure-chevron[^}]*\{[^}]*transform:\s*rotate\(90deg\);/s,
		);
	});

	it("uses the shared chevron in every specialized disclosure", () => {
		for (const relativePath of specializedDisclosureConsumers) {
			const source = readFileSync(join(sourceRoot, relativePath), "utf8");
			expect(source, relativePath).toContain("DisclosureChevron");
		}
	});
});
