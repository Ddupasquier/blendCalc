import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	statSync,
	symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServerTesseractWorkerOptions } from "../../src/lib/server/ocr/serverTesseractCache.server.js";

const read = (path: string) => readFileSync(path, "utf8");

describe("OCR runtime assets", () => {
	let directory: string;
	beforeEach(() => {
		directory = mkdtempSync(join(tmpdir(), "blendcalc-ocr-cache-test-"));
		vi.spyOn(process, "cwd").mockReturnValue(directory);
		vi.stubEnv("VERCEL", "");
	});
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllEnvs();
		rmSync(directory, { recursive: true, force: true });
	});

	it("creates the local server cache inside its checkout", () => {
		const { cachePath } = createServerTesseractWorkerOptions();
		expect(cachePath).toBe(
			join(directory, ".cache", "tesseract-language-data"),
		);
		expect(statSync(cachePath).isDirectory()).toBe(true);
	});

	it("keeps hosted OCR on the writable temporary filesystem", () => {
		vi.stubEnv("VERCEL", "1");
		vi.stubEnv("TMPDIR", directory);
		expect(createServerTesseractWorkerOptions().cachePath).toBe(
			join(directory, "blendcalc", "tesseract-language-data"),
		);
	});

	it("refuses a local OCR cache redirected outside its owner", () => {
		mkdirSync(join(directory, ".cache"));
		symlinkSync(
			directory,
			join(directory, ".cache", "tesseract-language-data"),
		);
		expect(() => createServerTesseractWorkerOptions()).toThrow("not symlinks");
	});

	it("uses the same cache owner for nutrition and product placement", () => {
		vi.restoreAllMocks();
		const nutritionProcessor = read(
			"src/lib/server/ocr/nutritionLabelOcrProcessor.server.ts",
		);
		const placementProcessor = read(
			"src/lib/server/products/automaticFoodImagePlacement.server.ts",
		);

		expect(nutritionProcessor).toContain(
			"createServerTesseractWorkerOptions()",
		);
		expect(placementProcessor).toContain(
			"createServerTesseractWorkerOptions()",
		);
		expect(read(".gitignore")).toContain("*.traineddata");
	});
});
