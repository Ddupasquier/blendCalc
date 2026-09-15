import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SERVER_TESSERACT_CACHE_PATH = join(
	tmpdir(),
	"blendcalc",
	"tesseract-language-data",
);

export const createServerTesseractWorkerOptions = () => {
	mkdirSync(SERVER_TESSERACT_CACHE_PATH, { recursive: true });
	return { cachePath: SERVER_TESSERACT_CACHE_PATH };
};
