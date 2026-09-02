import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	buildMigrationManifest,
	parseLinkedMigrationList,
	readCopyRowCounts,
	readMigrationCutoff,
	validateMigrationManifest,
} from "../../scripts/lib/recovery/protectedBackup.mjs";

const temporaryDirectories = [];

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((directory) => rm(directory, { recursive: true, force: true })),
	);
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
