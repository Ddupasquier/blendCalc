import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = join(process.cwd(), "src");
const sharedMotionStylesPath = join(
	sourceRoot,
	"lib/utils/animation/_motion.scss",
);

const getFiles = (directory: string, extensions: string[]): string[] =>
	readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) return getFiles(path, extensions);
		if (
			entry.isFile() &&
			extensions.some((extension) => entry.name.endsWith(extension))
		) {
			return [path];
		}
		return [];
	});

describe("functional motion architecture", () => {
	it("routes JavaScript-driven Svelte transition timing through reduced-motion handling", () => {
		const unsafeTransitionFiles = getFiles(sourceRoot, [".svelte"])
			.filter((path) => readFileSync(path, "utf8").includes("transition:"))
			.filter((path) => {
				const source = readFileSync(path, "utf8");
				return !source.includes("getMotionSafeDuration") &&
					!source.includes("getFeedbackFlyTransition");
			})
			.map((path) => path.slice(process.cwd().length + 1));

		expect(unsafeTransitionFiles).toEqual([]);
	});

	it("keeps shared state and feedback timing in the motion catalog", () => {
		const repeatedTimingPattern =
			/(?:120|160|180|220|320)ms|0\.(?:12|15|16|18|32)s/g;
		const localTimingFiles = getFiles(sourceRoot, [".scss", ".css"])
			.filter((path) => path !== sharedMotionStylesPath)
			.flatMap((path) => {
				const matches = readFileSync(path, "utf8").match(repeatedTimingPattern);
				return matches ? [path.slice(process.cwd().length + 1)] : [];
			});

		expect(localTimingFiles).toEqual([]);
	});
});
