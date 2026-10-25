import { mkdtemp, rm, writeFile } from "node:fs/promises";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	buildMigrationManifest,
	parseLinkedMigrationList,
	readCopyRowCounts,
	readMigrationCutoff,
	resolveProtectedBackupRoot,
	validateMigrationManifest,
} from "../../scripts/lib/recovery/protectedBackup.mjs";

const temporaryDirectories = [];

afterEach(async () => {
	vi.restoreAllMocks();
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((directory) => rm(directory, { recursive: true, force: true })),
	);
});

describe("external protected backup placement", () => {
	const makeRoot = async () => {
		const root = await mkdtemp(
			path.join(os.tmpdir(), "blendcalc-backup-placement-"),
		);
		temporaryDirectories.push(root);
		// Simulate a distinct external volume on CI as well as local machines.
		const stat = fs.statSync;
		vi.spyOn(fs, "statSync").mockImplementation((name, ...args) =>
			name === "/" || name === os.homedir()
				? Object.assign(Object.create(stat(name, ...args)), { dev: -1 })
				: stat(name, ...args),
		);
		return root;
	};

	it("selects external durable storage without creating it", async () => {
		const root = await makeRoot();
		const approved = path.join(
			fs.realpathSync(root),
			".local-data/blendCalc/backups",
		);
		expect(resolveProtectedBackupRoot({ developmentRoot: root })).toBe(
			approved,
		);
		expect(fs.existsSync(approved)).toBe(false);
		expect(
			resolveProtectedBackupRoot({
				developmentRoot: root,
				outputDirectory: path.join(approved, "manual"),
			}),
		).toBe(path.join(approved, "manual"));
	});

	it("resolves the Development compatibility alias", async () => {
		const root = await makeRoot();
		const alias = path.join(root, "alias");
		fs.symlinkSync(root, alias);
		expect(resolveProtectedBackupRoot({ developmentRoot: alias })).toBe(
			path.join(fs.realpathSync(root), ".local-data/blendCalc/backups"),
		);
	});

	it("refuses unavailable and internal storage without a fallback", async () => {
		const root = await makeRoot();
		const missing = path.join(root, "unavailable");
		expect(() =>
			resolveProtectedBackupRoot({ developmentRoot: missing }),
		).toThrow();
		expect(fs.existsSync(missing)).toBe(false);
		const actual = fs.statSync(root);
		fs.statSync.mockImplementation(() => actual);
		expect(() => resolveProtectedBackupRoot({ developmentRoot: root })).toThrow(
			"external development volume",
		);
	});

	it("rejects the internal Data volume even when '/' has another device ID", async () => {
		const root = await makeRoot();
		const actual = fs.lstatSync(root);
		fs.statSync.mockImplementation((name) =>
			name === "/" ? { dev: -1 } : actual,
		);
		expect(() => resolveProtectedBackupRoot({ developmentRoot: root })).toThrow(
			"external development volume",
		);
	});

	it("rejects relative paths, traversal and sibling-prefix escapes", async () => {
		const root = await makeRoot();
		for (const outputDirectory of [
			"relative",
			path.join(root, "outside"),
			path.join(root, ".local-data/blendCalc/backups-elsewhere"),
		]) {
			expect(() =>
				resolveProtectedBackupRoot({ developmentRoot: root, outputDirectory }),
			).toThrow();
		}
	});

	it("refuses redirected ancestors and non-directory leaves", async () => {
		const root = await makeRoot();
		fs.symlinkSync(root, path.join(root, ".local-data"));
		expect(() => resolveProtectedBackupRoot({ developmentRoot: root })).toThrow(
			"regular directories",
		);
		fs.unlinkSync(path.join(root, ".local-data"));
		fs.mkdirSync(path.join(root, ".local-data/blendCalc"), { recursive: true });
		fs.writeFileSync(
			path.join(root, ".local-data/blendCalc/backups"),
			"preserve",
		);
		expect(() => resolveProtectedBackupRoot({ developmentRoot: root })).toThrow(
			"regular directories",
		);
		expect(
			fs.readFileSync(path.join(root, ".local-data/blendCalc/backups"), "utf8"),
		).toBe("preserve");
	});
});

describe("protected backup recovery", () => {
	it("records an ordered linked migration history", () => {
		const versions = parseLinkedMigrationList(
			JSON.stringify({
				migrations: [
					{ local: "20260801000000", remote: "20260801000000" },
					{ local: "20260802000000", remote: "20260802000000" },
				],
			}),
		);
		const manifest = buildMigrationManifest(
			versions,
			"2026-08-31T23:00:00.000Z",
		);

		expect(validateMigrationManifest(manifest)).toEqual({
			createdAt: "2026-08-31T23:00:00.000Z",
			latestMigrationVersion: "20260802000000",
			migrations: ["20260801000000", "20260802000000"],
		});
	});

	it("rejects missing, unordered, and inconsistent migration histories", () => {
		expect(() => parseLinkedMigrationList('{"migrations":[]}')).toThrow(
			"empty or invalid",
		);
		expect(() =>
			validateMigrationManifest({
				latestMigrationVersion: "20260801000000",
				migrations: ["20260802000000", "20260801000000"],
			}),
		).toThrow("unique and ordered");
		expect(() =>
			validateMigrationManifest({
				latestMigrationVersion: "20260801000000",
				migrations: ["20260802000000"],
			}),
		).toThrow("valid ordered migration history");
	});

	it("reads exact COPY counts without loading backup data into memory", async () => {
		const directory = await mkdtemp(
			path.join(os.tmpdir(), "blendcalc-backup-copy-"),
		);
		temporaryDirectories.push(directory);
		const dataPath = path.join(directory, "public-data.sql");
		await writeFile(
			dataPath,
			[
				"COPY public.shared_products (id, product_name) FROM stdin;",
				"1\tWater",
				"2\tOil",
				"\\.",
				'COPY "public"."shared_product_revisions" ("id") FROM stdin;',
				"10",
				"\\.",
			].join("\n"),
			"utf8",
		);

		expect(Object.fromEntries(await readCopyRowCounts(dataPath))).toEqual({
			shared_products: 2,
			shared_product_revisions: 1,
		});
	});

	it("requires an explicit cutoff only for legacy backups", async () => {
		const directory = await mkdtemp(
			path.join(os.tmpdir(), "blendcalc-backup-manifest-"),
		);
		temporaryDirectories.push(directory);
		expect(() => readMigrationCutoff(directory)).toThrow(
			"legacy backup has no migration manifest",
		);
		expect(readMigrationCutoff(directory, "20260810120000")).toMatchObject({
			migrationCutoff: "20260810120000",
			usedLegacyCutoff: true,
		});

		await writeFile(
			path.join(directory, "migration-manifest.json"),
			JSON.stringify(
				buildMigrationManifest(["20260810120000", "20260811120000"]),
			),
			"utf8",
		);
		expect(readMigrationCutoff(directory)).toMatchObject({
			migrationCutoff: "20260811120000",
			usedLegacyCutoff: false,
		});
	});
});
