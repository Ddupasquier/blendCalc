import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { localArtifactCacheDirectory } from "../../../../config/runtimeArtifactPaths.js";

export const createServerTesseractWorkerOptions = () => {
	const cachePath =
		process.env.VERCEL === "1"
			? join(tmpdir(), "blendcalc", "tesseract-language-data")
			: localArtifactCacheDirectory(process.cwd(), "tesseract-language-data");
	mkdirSync(cachePath, { recursive: true });
	return { cachePath };
};
