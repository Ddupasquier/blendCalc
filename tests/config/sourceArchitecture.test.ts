import {
	existsSync,
	readdirSync,
	readFileSync,
	statSync,
} from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = resolve("src");
const libraryRoot = join(sourceRoot, "lib");
const componentRoots = [
	join(libraryRoot, "components"),
	join(libraryRoot, "assets", "icons"),
];
const sourceExtensions = [".ts", ".js", ".svelte"];

const walkFiles = (directory: string): string[] =>
	readdirSync(directory).flatMap((entry) => {
		const path = join(directory, entry);
		return statSync(path).isDirectory() ? walkFiles(path) : [path];
	});

const walkDirectories = (directory: string): string[] => [
	directory,
	...readdirSync(directory).flatMap((entry) => {
		const path = join(directory, entry);
		return statSync(path).isDirectory() ? walkDirectories(path) : [];
	}),
];

const componentFiles = componentRoots.flatMap(walkFiles);
const sourceFiles = walkFiles(sourceRoot).filter(
	(path) =>
		sourceExtensions.includes(extname(path)) &&
		!path.endsWith(".d.ts"),
);
const sourceFileSet = new Set(sourceFiles);

const resolveSourceImport = (
	specifier: string,
	importer: string,
): string | null => {
	let unresolvedPath: string;
	if (specifier.startsWith("$lib/")) {
		unresolvedPath = join(libraryRoot, specifier.slice("$lib/".length));
	} else if (specifier.startsWith(".")) {
		unresolvedPath = resolve(dirname(importer), specifier);
	} else {
		return null;
	}

	const candidates = [
		unresolvedPath,
		...sourceExtensions.map((extension) => `${unresolvedPath}${extension}`),
		...sourceExtensions.map((extension) =>
			join(unresolvedPath, `index${extension}`),
		),
	];
	return candidates.find((candidate) => sourceFileSet.has(candidate)) ?? null;
};

const readSourceImports = (path: string): string[] => {
	const source = readFileSync(path, "utf8");
	const dependencies = new Set<string>();
	const patterns = [
		/(?:from\s*|import\s*\()\s*["']([^"']+)["']/g,
		/import\s*["']([^"']+)["']/g,
	];

	for (const pattern of patterns) {
		for (const match of source.matchAll(pattern)) {
			const dependency = resolveSourceImport(match[1], path);
			if (dependency) dependencies.add(dependency);
		}
	}

	return [...dependencies];
};

describe("source architecture", () => {
	it("does not recreate generic dumping folders", () => {
		const forbiddenFolders = new Set(["defaults", "helpers", "misc", "shared"]);
		const dumpingFolders = walkDirectories(sourceRoot).filter((directory) =>
			forbiddenFolders.has(basename(directory)),
		);
		expect(dumpingFolders).toEqual([]);
	});

	it("uses stable PascalCase names for component folders", () => {
		for (const componentPath of componentFiles.filter(
			(path) => extname(path) === ".svelte",
		)) {
			expect(basename(dirname(componentPath)), componentPath).toMatch(
				/^[A-Z][A-Za-z0-9]*$/,
			);
		}
	});

	it("keeps component prop contracts with their namesake component", () => {
		for (const typesPath of componentFiles.filter(
			(path) => basename(path) === "types.ts",
		)) {
			const ownerName = basename(dirname(typesPath));
			const ownerPath = join(dirname(typesPath), `${ownerName}.svelte`);
			const source = readFileSync(typesPath, "utf8");

			if (!existsSync(ownerPath)) {
				const sharedPropNames = [
					...source.matchAll(/export\s+type\s+(\w+Props)\b/g),
				].map((match) => match[1]);
				for (const propName of sharedPropNames) {
					const consumers = componentFiles.filter(
						(path) =>
							extname(path) === ".svelte" &&
							readFileSync(path, "utf8").includes(propName),
					);
					expect(consumers.length, `${propName} in ${typesPath}`).toBeGreaterThan(1);
				}
				continue;
			}

			expect(readFileSync(ownerPath, "utf8"), ownerPath).toMatch(
				/from\s+["']\.\/types["']/,
			);
		}
	});

	it("keeps prop type declarations out of Svelte files", () => {
		for (const componentPath of sourceFiles.filter(
			(path) => extname(path) === ".svelte",
		)) {
			const source = readFileSync(componentPath, "utf8");
			const script = source.match(/<script[^>]*>([\s\S]*?)<\/script>/)?.[1] ?? "";
			expect(script, componentPath).not.toMatch(
				/}\s*:\s*{[\s\S]*?}\s*=\s*\$props\(\)/,
			);
		}
	});

	it("keeps every application source module reachable", () => {
		const dependencyMap = new Map(
			sourceFiles.map((path) => [path, readSourceImports(path)]),
		);
		const entrypoints = sourceFiles.filter(
			(path) =>
				path.includes(`${join(sourceRoot, "routes")}/`) ||
				basename(path).startsWith("hooks.") ||
				path === join(libraryRoot, "index.ts"),
		);
		const reachable = new Set<string>();
		const pending = [...entrypoints];

		while (pending.length > 0) {
			const path = pending.pop();
			if (!path || reachable.has(path)) continue;
			reachable.add(path);
			pending.push(...(dependencyMap.get(path) ?? []));
		}

		const allowedGeneratedFiles = new Set([
			join(libraryRoot, "types", "database.types.ts"),
		]);
		const unreachableFiles = sourceFiles.filter(
			(path) =>
				path.startsWith(`${libraryRoot}/`) &&
				!reachable.has(path) &&
				!allowedGeneratedFiles.has(path),
		);

		expect(unreachableFiles).toEqual([]);
	});
});
