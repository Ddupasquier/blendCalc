import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const scriptsRoot = path.resolve("scripts");
const ignoredOutputDirectory = `${path.sep}output${path.sep}`;
const packageMetadata = JSON.parse(await readFile("package.json", "utf8"));
const scriptDocumentation = await readFile("scripts/README.md", "utf8");

const collectScriptFiles = async (directory) => {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = await Promise.all(
		entries.map(async (entry) => {
			const entryPath = path.join(directory, entry.name);
			if (entry.isDirectory()) return collectScriptFiles(entryPath);
			return entry.isFile() && entry.name.endsWith(".mjs") ? [entryPath] : [];
		}),
	);
	return files.flat().sort();
};

const scriptFiles = (await collectScriptFiles(scriptsRoot)).filter(
	(filePath) => !filePath.includes(ignoredOutputDirectory),
);
const executableDomainsByOperation = {
	audits: ["catalog", "food-sources", "security"],
	backfills: ["catalog", "images"],
	generators: ["api"],
	imports: ["nutrition"],
	operations: [
		"auth",
		"blendCalcAPI",
		"database",
		"quality",
		"recovery",
		"releases",
		"users",
	],
	qa: ["catalog", "database"],
	seeds: ["catalog", "food-safety", "nutrition"],
};
const sharedLibraryDomains = [
	"barcode",
	"catalog",
	"images",
	"nutrition",
	"qa",
	"quality",
	"reference-data",
	"releases",
	"security",
];

describe("repository script headers", () => {
	it("keeps executable workflows in operation and domain folders", () => {
		const executableScriptPaths = scriptFiles
			.map((filePath) => path.relative(scriptsRoot, filePath))
			.filter((relativePath) => !relativePath.startsWith(`lib${path.sep}`));

		for (const relativePath of executableScriptPaths) {
			const [operation, domain, fileName, ...unexpectedSegments] =
				relativePath.split(path.sep);
			expect(
				Object.keys(executableDomainsByOperation),
				`${relativePath} must use a recognized operation folder`,
			).toContain(operation);
			expect(
				executableDomainsByOperation[operation],
				`${relativePath} must use a recognized ${operation} domain folder`,
			).toContain(domain);
			expect(
				fileName,
				`${relativePath} must include a script filename`,
			).toMatch(/\.mjs$/u);
			expect(
				unexpectedSegments,
				`${relativePath} is nested more deeply than operation/domain/file`,
			).toHaveLength(0);
		}
	});

	it("keeps shared script libraries in named domain folders", () => {
		const sharedLibraryPaths = scriptFiles
			.map((filePath) => path.relative(scriptsRoot, filePath))
			.filter((relativePath) => relativePath.startsWith(`lib${path.sep}`));

		for (const relativePath of sharedLibraryPaths) {
			const [libraryFolder, domain, fileName, ...unexpectedSegments] =
				relativePath.split(path.sep);
			expect(libraryFolder).toBe("lib");
			expect(
				sharedLibraryDomains,
				`${relativePath} must use a recognized shared-library domain`,
			).toContain(domain);
			expect(
				fileName,
				`${relativePath} must include a module filename`,
			).toMatch(/\.mjs$/u);
			expect(
				unexpectedSegments,
				`${relativePath} is nested more deeply than lib/domain/file`,
			).toHaveLength(0);
		}
	});

	it("keeps every package script entry point on disk", async () => {
		for (const [command, definition] of Object.entries(
			packageMetadata.scripts,
		)) {
			const scriptPaths = [
				...definition.matchAll(/(?:^|\s)node\s+(scripts\/[^\s"'`]+\.mjs)/gu),
			].map((match) => match[1]);
			for (const scriptPath of scriptPaths) {
				await expect(
					access(path.resolve(scriptPath)),
					`${command} references missing ${scriptPath}`,
				).resolves.toBeUndefined();
			}
		}
	});

	it("keeps internal seed and backfill workflows out of the npm command surface", () => {
		for (const [command, definition] of Object.entries(
			packageMetadata.scripts,
		)) {
			expect(
				definition,
				`${command} must use the documented direct script command`,
			).not.toMatch(/node\s+scripts\/(?:backfills|seeds)\//u);
		}
	});

	it("documents every direct executable workflow", () => {
		const executableScriptPaths = scriptFiles
			.map((filePath) =>
				path.relative(process.cwd(), filePath).split(path.sep).join("/"),
			)
			.filter((relativePath) => !relativePath.startsWith("scripts/lib/"));

		for (const relativePath of executableScriptPaths) {
			const packageCommands = Object.entries(packageMetadata.scripts)
				.filter(([, definition]) => definition.includes(relativePath))
				.map(([command]) => command);
			const hasDocumentedPackageCommand = packageCommands.some((command) =>
				scriptDocumentation.includes(`npm run ${command}`),
			);
			expect(
				scriptDocumentation.includes(relativePath) ||
					hasDocumentedPackageCommand,
				`${relativePath} must be documented in scripts/README.md`,
			).toBe(true);
		}
	});

	it.each(scriptFiles)(
		"documents purpose and execution for %s",
		async (filePath) => {
			const source = await readFile(filePath, "utf8");
			const header = source.match(/^\/\*\*[\s\S]*?\*\//u)?.[0] ?? "";

			expect(header).toContain("Purpose:");
			if (filePath.includes(`${path.sep}lib${path.sep}`)) {
				expect(header).toContain("Do not run directly");
			} else {
				expect(header).toMatch(
					/(?:Run|Preview|Validate only|Role example|Seed): `[^`]+`/u,
				);
				const npmCommands = [...header.matchAll(/npm run ([\w:-]+)/gu)].map(
					(match) => match[1],
				);
				const directScriptPaths = [
					...header.matchAll(/node (scripts\/[^\s`]+\.mjs)/gu),
				].map((match) => match[1]);
				expect(npmCommands.length + directScriptPaths.length).toBeGreaterThan(
					0,
				);
				for (const command of npmCommands) {
					expect(packageMetadata.scripts).toHaveProperty(command);
				}
				for (const directScriptPath of directScriptPaths) {
					expect(directScriptPath).toBe(
						path.relative(process.cwd(), filePath).split(path.sep).join("/"),
					);
				}
			}
		},
	);
});
