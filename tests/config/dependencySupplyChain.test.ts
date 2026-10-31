import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

type PackageMetadata = {
	allowScripts?: Record<string, boolean>;
	devDependencies?: Record<string, string>;
};

type PackageLock = {
	packages: Record<
		string,
		{ integrity?: string; resolved?: string; version?: string }
	>;
};

const packageMetadata = JSON.parse(
	readFileSync("package.json", "utf8"),
) as PackageMetadata;
const packageLock = JSON.parse(
	readFileSync("package-lock.json", "utf8"),
) as PackageLock;

describe("dependency supply-chain configuration", () => {
	it("resolves the plugin's reviewed security fork without changing the plugin", () => {
		const plugin =
			packageLock.packages["node_modules/@sveltejs/vite-plugin-svelte"];
		const patched =
			packageLock.packages[
				"node_modules/@sveltejs/vite-plugin-svelte/node_modules/deepmerge"
			];
		expect(plugin.version).toBe("7.2.0");
		expect(patched.version).toBe("4.3.2");
		expect(patched.resolved).toBe(
			"https://registry.npmjs.org/@oss-cve-patches/deepmerge/-/deepmerge-4.3.2.tgz",
		);
		expect(patched.integrity).toBe(
			"sha512-+bwDJSwj3aBdqYf5FetlCvGMrh4LAemnTwmTdN8QaNj4R4+EYuQostFyu2fr2wTACTqCOkYSg7Kju8xrUwxyRg==",
		);
		expect(packageLock.packages).not.toHaveProperty("node_modules/deepmerge");
	});

	describe("the merge implementation actually resolved by the Svelte plugin", () => {
		const localRequire = createRequire(import.meta.url);
		const pluginRequire = createRequire(
			localRequire.resolve("@sveltejs/vite-plugin-svelte"),
		);
		const merge = pluginRequire("deepmerge") as (
			target: Record<string, unknown>,
			source: Record<string, unknown>,
			options?: {
				arrayMerge: (target: unknown[], source: unknown[]) => unknown[];
			},
		) => Record<string, unknown>;

		it.each(["target", "source", "null-prototype", "nested"])(
			"rejects prototype replacement from %s while preserving ordinary options",
			(position) => {
				const hostile = JSON.parse(
					'{"__proto__":{"pollutionCanary":true},"safe":7}',
				);
				const result =
					position === "target"
						? merge(hostile, { enabled: true })
						: position === "source"
							? merge({}, hostile)
							: position === "null-prototype"
								? merge(Object.create(null), hostile)
								: merge(
										{ compilerOptions: null },
										{ compilerOptions: hostile },
									);
				const checked = position === "nested" ? result.compilerOptions : result;
				expect(Object.getPrototypeOf(checked)).toBe(Object.prototype);
				expect(Object.hasOwn(checked as object, "__proto__")).toBe(false);
				expect(checked).toHaveProperty("safe", 7);
				expect(checked).not.toHaveProperty("pollutionCanary");
				expect(Object.prototype).not.toHaveProperty("pollutionCanary");
			},
		);

		it("preserves the plugin's replacement-array and nested-option semantics", () => {
			const preprocess = () => "preprocess";
			const target = {
				compilerOptions: { dev: true },
				preprocess: [() => "old"],
			};
			const source = {
				compilerOptions: { css: "external" },
				preprocess: [preprocess],
			};
			const result = merge(target, source, {
				arrayMerge: (_target, incoming) => incoming,
			});
			expect(result).toEqual({
				compilerOptions: { dev: true, css: "external" },
				preprocess: [preprocess],
			});
			expect(target.compilerOptions).toEqual({ dev: true });
			expect(source.compilerOptions).toEqual({ css: "external" });
		});
	});

	it("allows only exact installed package script versions", () => {
		const entries = Object.entries(packageMetadata.allowScripts ?? {});
		expect(entries.length).toBeGreaterThan(0);

		for (const [specifier, enabled] of entries) {
			const versionSeparator = specifier.lastIndexOf("@");
			const packageName = specifier.slice(0, versionSeparator);
			const version = specifier.slice(versionSeparator + 1);

			expect(enabled, specifier).toBe(true);
			expect(packageName, specifier).not.toBe("");
			expect(version, specifier).toMatch(/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/);
			const installedVersions = Object.entries(packageLock.packages)
				.filter(([packagePath]) =>
					packagePath.endsWith(`node_modules/${packageName}`),
				)
				.map(([, metadata]) => metadata.version);
			expect(installedVersions, specifier).toContain(version);
		}
	});

	it("does not grant wildcard script approval", () => {
		const allowedSpecifiers = Object.keys(packageMetadata.allowScripts ?? {});
		expect(allowedSpecifiers).not.toContain("*");
		expect(
			allowedSpecifiers.every((specifier) => !specifier.includes("*")),
		).toBe(true);
	});

	it("installs the exact public Rehearsal release from npm", () => {
		const packageName = "@rehearsal-db/core";
		const version = "1.0.2";
		const installedPackage =
			packageLock.packages[`node_modules/${packageName}`];

		expect(packageMetadata.devDependencies?.[packageName]).toBe(version);
		expect(installedPackage?.version).toBe(version);
		expect(installedPackage?.resolved).toBe(
			`https://registry.npmjs.org/@rehearsal-db/core/-/core-${version}.tgz`,
		);
		expect(installedPackage?.integrity).toBe(
			"sha512-VuNI71ClTrFdpdYh64C+9rhFNwE6g4gpAKdnCO3actpxL6hHU69qMcCen8DQc4h21Dhcmal4kP0pmQhf2/6prw==",
		);
		expect(packageMetadata.devDependencies).not.toHaveProperty("@rehearsal/db");
		expect(packageLock.packages).not.toHaveProperty(
			"node_modules/@rehearsal/db",
		);
	});

	it("keeps patched image and parser packages above their security floors", () => {
		for (const [name, minimum] of [
			["sharp", [0, 35, 5]],
			["source-map-js", [1, 2, 2]],
			["postcss-selector-parser", [7, 1, 6]],
			["vitest", [4, 1, 12]],
			["@vitest/mocker", [4, 1, 12]],
		] as const) {
			const version = packageLock.packages[`node_modules/${name}`]?.version;
			expect(version, name).toMatch(/^\d+\.\d+\.\d+$/);
			const actual = version!.split(".").map(Number);
			const order = actual.findIndex((part, index) => part !== minimum[index]);
			expect(order === -1 || actual[order] > minimum[order], name).toBe(true);
		}
	});
});

const securityFixtures: string[] = [];
afterEach(async () => {
	for (const root of securityFixtures.splice(0))
		await rm(root, { recursive: true, force: true });
});
const securityFixture = async () => {
	const root = await mkdtemp(join(tmpdir(), "dependency-compatibility-"));
	securityFixtures.push(root);
	return root;
};
const projectRequire = createRequire(import.meta.url);
const fromConsumer = (name: string) =>
	createRequire(projectRequire.resolve(name));

describe("scoped glob and minimatch security compatibility", () => {
	it("repairs only the affected consumers while preserving their reviewed versions", () => {
		for (const [name, version] of [
			["@vercel/nft", "1.10.2"],
			["rimraf", "6.1.3"],
			["eslint", "10.9.0"],
			["@eslint/config-array", "0.23.5"],
			["@typescript-eslint/typescript-estree", "8.67.0"],
		] as const) {
			expect(packageLock.packages[`node_modules/${name}`].version).toBe(
				version,
			);
			const consumer = fromConsumer(name);
			if (name === "rimraf" || name === "@vercel/nft") {
				expect(consumer("glob/package.json").version).toBe("14.0.2");
				const globRequire = createRequire(consumer.resolve("glob"));
				expect(globRequire("minimatch/package.json").version).toBe("11.0.1");
			} else expect(consumer("minimatch/package.json").version).toBe("11.0.1");
		}
	});

	it("keeps NFT wildcard assets and dotfiles while excluding nested node_modules", async ({
		onTestFailed,
	}) => {
		let phase = "fixture";
		onTestFailed(() =>
			console.error(JSON.stringify({ consumer: "nft", phase })),
		);
		const root = await securityFixture();
		await mkdir(join(root, "assets/node_modules/private"), { recursive: true });
		await writeFile(
			join(root, "entry.cjs"),
			"require('node:fs').readFileSync(__dirname + '/assets/' + process.env.SYNTHETIC_ASSET);\n",
		);
		await writeFile(join(root, "assets/visible.txt"), "asset");
		await writeFile(join(root, "assets/.hidden.txt"), "dot asset");
		await writeFile(
			join(root, "assets/node_modules/private/not-an-asset.txt"),
			"excluded",
		);
		phase = "module-load";
		const { nodeFileTrace } = projectRequire("@vercel/nft");
		phase = "trace";
		const result = await nodeFileTrace([join(root, "entry.cjs")], {
			base: root,
			processCwd: root,
		});
		phase = "assertions";
		expect([...result.fileList]).toEqual(
			expect.arrayContaining([
				"entry.cjs",
				"assets/visible.txt",
				"assets/.hidden.txt",
			]),
		);
		expect(
			[...result.fileList].some((name: string) =>
				name.includes("assets/node_modules/"),
			),
		).toBe(false);
		expect([...result.warnings]).toEqual([]);
	});

	it("keeps rimraf async/sync brace matching inside an owned tree and preserves the outside sentinel", async () => {
		const root = await securityFixture();
		const directory = join(root, "remove");
		await mkdir(directory);
		await writeFile(join(root, "sentinel.txt"), "keep");
		await writeFile(join(directory, "one.txt"), "remove");
		await writeFile(join(directory, "two.log"), "remove");
		await writeFile(join(directory, ".hidden.txt"), "remove");
		await writeFile(join(directory, "keep.json"), "keep");
		const { rimraf, rimrafSync } = projectRequire("rimraf");
		await rimraf(join(directory, "*.{txt,log}"), { glob: { dot: true } });
		expect(await readFile(join(directory, "keep.json"), "utf8")).toBe("keep");
		await writeFile(join(directory, "three.txt"), "remove");
		rimrafSync(join(directory, "*.txt"), { glob: { dot: true } });
		expect(await readFile(join(root, "sentinel.txt"), "utf8")).toBe("keep");
		expect(
			await import("node:fs/promises").then((fs) => fs.readdir(directory)),
		).toEqual(["keep.json"]);
	});

	it("preserves actual ESLint file discovery, ignore boundaries and partial glob traversal", async ({
		onTestFailed,
	}) => {
		let phase = "fixture";
		onTestFailed(() =>
			console.error(JSON.stringify({ consumer: "eslint", phase })),
		);
		const root = await securityFixture();
		await mkdir(join(root, "nested/deeper"), { recursive: true });
		await mkdir(join(root, "ignored"));
		await writeFile(
			join(root, "nested/deeper/valid.js"),
			"console.log('valid');\n",
		);
		await writeFile(
			join(root, "nested/deeper/unused.js"),
			"const unused = 1;\n",
		);
		await writeFile(
			join(root, "ignored/not-linted.js"),
			"const ignored = 1;\n",
		);
		phase = "module-load";
		const { ESLint } = projectRequire("eslint");
		phase = "configuration";
		const lint = new ESLint({
			cwd: root,
			overrideConfigFile: true,
			overrideConfig: [
				{ ignores: ["ignored/**"] },
				{ files: ["**/*.js"], rules: { "no-unused-vars": "error" } },
			],
		});
		phase = "lint-files";
		const results = await lint.lintFiles(["**/*.js"]);
		phase = "assertions";
		expect(
			results
				.map((row: { filePath: string }) => row.filePath.slice(root.length + 1))
				.sort(),
		).toEqual(["nested/deeper/unused.js", "nested/deeper/valid.js"]);
		expect(
			results.flatMap((row: { messages: { ruleId: string }[] }) =>
				row.messages.map((item) => item.ruleId),
			),
		).toEqual(["no-unused-vars"]);
		const { minimatch } = fromConsumer("@typescript-eslint/typescript-estree")(
			"minimatch",
		);
		expect(minimatch(".config/check.js", ".config/*.js", { dot: true })).toBe(
			true,
		);
		expect(minimatch("src/check.ts", ".config/*.js", { dot: true })).toBe(
			false,
		);
	});

	it("bounds globparts amplification in each actual minimatch consumer in a separate child", () => {
		for (const name of [
			"eslint",
			"@eslint/config-array",
			"@typescript-eslint/typescript-estree",
		]) {
			const resolved = fromConsumer(name).resolve("minimatch");
			const script = `const assert=require('node:assert/strict');const {Minimatch}=require(${JSON.stringify(resolved)});const m=new Minimatch('**/../'.repeat(12)+'*.txt',{optimizationLevel:2,braceExpandMax:32});assert.ok(m.set.length<=32);`;
			const child = spawnSync(process.execPath, ["-e", script], {
				timeout: 3000,
				encoding: "utf8",
				maxBuffer: 65536,
			});
			expect(child.error, name).toBeUndefined();
			expect(child.status, name).toBe(0);
		}
	});

	it("stops actual glob filesystem traversal after AbortSignal cancellation", async () => {
		const root = await securityFixture();
		await mkdir(join(root, "nested/deeper"), { recursive: true });
		await writeFile(join(root, "nested/deeper/value.txt"), "value");
		const resolved = fromConsumer("@vercel/nft").resolve("glob");
		const script = `const assert=require('node:assert/strict');const fs=require('node:fs');const {glob}=require(${JSON.stringify(resolved)});const controller=new AbortController();let afterAbort=0,reads=0;const observed={...fs,readdir(...args){reads++;if(controller.signal.aborted)afterAbort++;const callback=args.pop();fs.readdir(...args,(...result)=>{controller.abort();callback(...result)})}};(async()=>{assert.ok((await glob('**/*',{cwd:${JSON.stringify(root)}})).length>=3);await assert.rejects(glob('**/*',{cwd:${JSON.stringify(root)},fs:observed,signal:controller.signal}));await new Promise(r=>setTimeout(r,50));assert.ok(reads>0);assert.equal(afterAbort,0)})().catch(()=>process.exitCode=1);`;
		const child = spawnSync(process.execPath, ["-e", script], {
			timeout: 3000,
			encoding: "utf8",
			maxBuffer: 65536,
		});
		expect(child.error).toBeUndefined();
		expect(child.status).toBe(0);
	});
});
