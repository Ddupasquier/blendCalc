import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const scriptsRoot = path.resolve("scripts");
const packageMetadata = JSON.parse(await readFile("package.json", "utf8"));

const collectScriptFiles = async (directory) => {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = await Promise.all(entries.map(async (entry) => {
		const entryPath = path.join(directory, entry.name);
		if (entry.isDirectory()) return collectScriptFiles(entryPath);
		return entry.isFile() && entry.name.endsWith(".mjs") ? [entryPath] : [];
	}));
	return files.flat().sort();
};

const scriptFiles = await collectScriptFiles(scriptsRoot);

describe("repository script headers", () => {
	it.each(scriptFiles)("documents purpose and execution for %s", async (filePath) => {
		const source = await readFile(filePath, "utf8");
		const header = source.match(/^\/\*\*[\s\S]*?\*\//u)?.[0] ?? "";

		expect(header).toContain("Purpose:");
		if (filePath.includes(`${path.sep}lib${path.sep}`)) {
			expect(header).toContain("Do not run directly");
		} else {
			expect(header).toMatch(
				/(?:Run|Preview|Validate only|Role example|Seed): `[^`]+`/u,
			);
			const npmCommands = [...header.matchAll(/npm run ([\w:-]+)/gu)]
				.map((match) => match[1]);
			expect(npmCommands.length).toBeGreaterThan(0);
			for (const command of npmCommands) {
				expect(packageMetadata.scripts).toHaveProperty(command);
			}
		}
	});
});
