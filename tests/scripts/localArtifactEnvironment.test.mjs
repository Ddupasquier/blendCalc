import { execFileSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	realpathSync,
	rmSync,
	symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createLocalArtifactEnvironment } from "../../config/runtimeArtifactPaths.js";

describe("local artifact environment", () => {
	let root;
	beforeEach(() => {
		root = mkdtempSync(join(tmpdir(), "blendcalc-artifacts-"));
	});
	afterEach(() => rmSync(root, { recursive: true, force: true }));

	it("overrides host temp/cache paths without copying unrelated credentials", () => {
		const environment = createLocalArtifactEnvironment(root, {
			CI: "",
			TMPDIR: "/wrong",
			NPM_CONFIG_CACHE: "/wrong",
		});
		for (const name of [
			"TMPDIR",
			"TMP",
			"TEMP",
			"npm_config_cache",
			"NPM_CONFIG_CACHE",
			"NODE_COMPILE_CACHE",
			"PLAYWRIGHT_BROWSERS_PATH",
		]) {
			expect(
				environment[name].startsWith(join(realpathSync(root), ".cache") + "/"),
			).toBe(true);
		}
		expect(environment).not.toHaveProperty("HOME");
		expect(existsSync(environment.TMPDIR)).toBe(true);
		expect(existsSync(environment.PLAYWRIGHT_BROWSERS_PATH)).toBe(false);
	});

	it("preserves the browser installation selected by hosted CI", () => {
		const environment = createLocalArtifactEnvironment(root, {
			CI: "true",
			PLAYWRIGHT_BROWSERS_PATH: "/runner/browser-cache",
		});
		expect(environment.PLAYWRIGHT_BROWSERS_PATH).toBe("/runner/browser-cache");
		expect(existsSync(join(root, ".cache", "playwright-browsers"))).toBe(false);
	});

	it("the actual child process uses the selected temporary directory", () => {
		const environment = createLocalArtifactEnvironment(root, {});
		const output = execFileSync(
			process.execPath,
			[
				"--input-type=module",
				"-e",
				'import {tmpdir} from "node:os"; console.log(tmpdir())',
			],
			{ env: environment, encoding: "utf8" },
		);
		expect(output.trim()).toBe(environment.TMPDIR);
	});

	it("resolves a checkout alias before constructing paths", () => {
		const checkout = join(root, "checkout");
		mkdirSync(checkout);
		const alias = join(root, "alias");
		symlinkSync(checkout, alias);
		expect(createLocalArtifactEnvironment(alias, {}).TMPDIR).toBe(
			join(realpathSync(checkout), ".cache", "tmp"),
		);
	});

	it("refuses symlinked artifact roots and never creates a missing checkout", () => {
		symlinkSync(root, join(root, ".cache"));
		expect(() => createLocalArtifactEnvironment(root, {})).toThrow(
			"not symlinks",
		);
		const missing = join(root, "missing");
		expect(() => createLocalArtifactEnvironment(missing, {})).toThrow();
		expect(existsSync(missing)).toBe(false);
	});

	it("refuses a cache leaf redirected outside its owner", () => {
		mkdirSync(join(root, ".cache"));
		symlinkSync(root, join(root, ".cache", "npm"));
		expect(() => createLocalArtifactEnvironment(root, {})).toThrow(
			"not symlinks",
		);
	});
});
