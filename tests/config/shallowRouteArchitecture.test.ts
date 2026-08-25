import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { describe, expect, it } from "vitest";

const applicationSourceRoot = join(process.cwd(), "src");
const sharedNavigatorPath = join(
	applicationSourceRoot,
	"lib",
	"utils",
	"navigation",
	"shallowRouteNavigation.ts",
);

const listSourceFiles = async (directory: string): Promise<string[]> => {
	const entries = await readdir(directory, { withFileTypes: true });
	const nestedFiles = await Promise.all(
		entries.map(async (entry) => {
			const path = join(directory, entry.name);
			if (entry.isDirectory()) return listSourceFiles(path);
			return [".svelte", ".ts"].includes(extname(entry.name)) ? [path] : [];
		}),
	);
	return nestedFiles.flat();
};

describe("shallow route navigation architecture", () => {
	it("keeps raw shallow-history writes inside the shared navigator", async () => {
		const sourceFiles = (await listSourceFiles(applicationSourceRoot)).filter(
			(path) => path !== sharedNavigatorPath,
		);
		const sourceContents = await Promise.all(
			sourceFiles.map(async (path) => ({
				path,
				contents: await readFile(path, "utf8"),
			})),
		);
		const directShallowHistoryWriters = sourceContents
			.filter(({ contents }) =>
				/\b(pushState|replaceState)\s*\(/.test(contents),
			)
			.map(({ path }) => path.slice(process.cwd().length + 1));

		expect(directShallowHistoryWriters).toEqual([]);
	});
});
