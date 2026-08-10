import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

const listTypeScriptFiles = (directory: string): string[] =>
	readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) return listTypeScriptFiles(path);
		return extname(entry.name) === ".ts" ? [path] : [];
	});

const serverFiles = [
	...listTypeScriptFiles(join(root, "src/lib/server")),
	...listTypeScriptFiles(join(root, "src/routes")).filter((path) =>
		/(?:\+server|\+page\.server|\+layout\.server)\.ts$/.test(path)
	),
	join(root, "src/hooks.server.ts"),
];

const runtimeTypeScriptFiles = listTypeScriptFiles(join(root, "src")).filter(
	(path) => !path.endsWith("database.types.ts"),
);

const findMatches = (pattern: RegExp) =>
	serverFiles.flatMap((path) => {
		const source = readFileSync(path, "utf8");
		return pattern.test(source) ? [relative(root, path)] : [];
	});

const findRuntimeMatches = (pattern: RegExp) =>
	runtimeTypeScriptFiles.flatMap((path) => {
		const source = readFileSync(path, "utf8");
		return pattern.test(source) ? [relative(root, path)] : [];
	});

describe("server request boundary", () => {
	it("keeps outbound fetch calls behind the shared request policy", () => {
		expect(findMatches(/\bfetch\s*\(/)).toEqual([]);
	});

	it("keeps server database reads limited to named columns", () => {
		expect(findRuntimeMatches(/\.select\(\s*["']\*["']\s*\)/)).toEqual([]);
	});
});
