import { readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { createServerTesseractWorkerOptions } from "../../src/lib/server/ocr/serverTesseractCache.server.js";

const read = (path: string) => readFileSync(path, "utf8");

describe("OCR runtime assets", () => {
	it("creates the server cache beneath the operating-system temporary directory", () => {
		const { cachePath } = createServerTesseractWorkerOptions();

		expect(cachePath.startsWith(tmpdir())).toBe(true);
		expect(cachePath).toContain("tesseract-language-data");
		expect(statSync(cachePath).isDirectory()).toBe(true);
	});

	it("keeps server Tesseract caches outside the repository root", () => {
		const cacheOwner = read(
			"src/lib/server/ocr/serverTesseractCache.server.ts",
		);
		const nutritionProcessor = read(
			"src/lib/server/ocr/nutritionLabelOcrProcessor.server.ts",
		);
		const placementProcessor = read(
			"src/lib/server/products/automaticFoodImagePlacement.server.ts",
		);

		expect(cacheOwner).toContain("tmpdir()");
		expect(cacheOwner).toContain('"tesseract-language-data"');
		expect(nutritionProcessor).toContain(
			"createServerTesseractWorkerOptions()",
		);
		expect(placementProcessor).toContain(
			"createServerTesseractWorkerOptions()",
		);
		expect(read(".gitignore")).toContain("*.traineddata");
	});
});
