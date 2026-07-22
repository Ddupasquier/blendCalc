import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sharedImporter = readFileSync(
	"scripts/lib/nutrition_dataset_import.mjs",
	"utf8",
);
const importers = [
	readFileSync("scripts/imports/import_cnf_2026.mjs", "utf8"),
	readFileSync("scripts/imports/import_cofid_2021.mjs", "utf8"),
];

describe("nutrition dataset download storage", () => {
	it("uses disposable operating-system directories", () => {
		expect(sharedImporter).toContain("mkdtemp");
		expect(sharedImporter).toContain("tmpdir()");
		expect(sharedImporter).toContain("rmSync");
	});

	it("does not create repository-local dataset caches", () => {
		for (const importer of importers) {
			expect(importer).not.toContain(".cache/nutrition-data");
			expect(importer).not.toContain("downloadCachedFile");
			expect(importer).toContain("createTemporaryDownloadDirectory");
		}
	});
});
