import { describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	assertNoCrossDatabaseMigrationVersions,
	buildMigrationLedgerInventory,
	compareSourceToReplay,
	createMigrationReplayReceipt,
	readMigrationSourceBundle,
} from "../../scripts/lib/rehearsal/migration_history.mjs";

const files = [
	{
		version: "20260912000000",
		name: "baseline",
		filename: "20260912000000_baseline.sql",
		fileSha256: "a".repeat(64),
	},
	{
		version: "20260912000100",
		name: "candidate",
		filename: "20260912000100_candidate.sql",
		fileSha256: "b".repeat(64),
	},
];
const rows = [
	{
		version: "20260912000000",
		name: "baseline",
		statements: ["create table example(id bigint);"],
	},
	{
		version: "20260912000100",
		name: "candidate",
		statements: ["alter table example add column label text;"],
	},
];

describe("Rehearsal migration history", () => {
	it("accepts an exact source prefix and identifies the candidate suffix", () => {
		const ledger = buildMigrationLedgerInventory(rows);
		const receipt = createMigrationReplayReceipt({ files, ledger });
		const receiptWithLoadedContents = createMigrationReplayReceipt({
			files: files.map((file) => ({
				...file,
				content: "not receipt metadata",
			})),
			ledger,
		});
		const result = compareSourceToReplay({
			sourceLedger: ledger.slice(0, 1),
			replayReceipt: receipt,
		});

		expect(result.cutoff).toBe("20260912000000");
		expect(result.candidates.map((entry) => entry.version)).toEqual([
			"20260912000100",
		]);
		expect(result.candidateSha256).toMatch(/^[a-f0-9]{64}$/u);
		expect(receiptWithLoadedContents).toEqual(receipt);
	});

	it("rejects edited applied statements under an unchanged version", () => {
		const ledger = buildMigrationLedgerInventory(rows);
		const receipt = createMigrationReplayReceipt({ files, ledger });
		const edited = buildMigrationLedgerInventory([
			{ ...rows[0], statements: ["create table example(id text);"] },
		]);

		expect(() =>
			compareSourceToReplay({ sourceLedger: edited, replayReceipt: receipt }),
		).toThrow("Applied statement content differs");
	});

	it("accepts historical ledger receipt drift only behind an exact schema snapshot", () => {
		const ledger = buildMigrationLedgerInventory(rows);
		const receipt = createMigrationReplayReceipt({ files, ledger });
		const edited = buildMigrationLedgerInventory([
			{ ...rows[0], statements: ["create table example(id text);"] },
		]);
		const result = compareSourceToReplay({
			sourceLedger: edited,
			replayReceipt: receipt,
			snapshotSchemaSha256: "c".repeat(64),
		});

		expect(result.historicalStatementDifferences).toBe(1);
		expect(result.snapshotSchemaSha256).toBe("c".repeat(64));
		expect(() =>
			compareSourceToReplay({
				sourceLedger: edited,
				replayReceipt: receipt,
				snapshotSchemaSha256: "unsafe",
			}),
		).toThrow("schema snapshot receipt is invalid");
	});

	it("rejects missing, duplicate, reordered, and cross-database history", () => {
		const ledger = buildMigrationLedgerInventory(rows);
		expect(() =>
			createMigrationReplayReceipt({ files: files.slice(0, 1), ledger }),
		).toThrow("length mismatch");
		expect(() => buildMigrationLedgerInventory([rows[0], rows[0]])).toThrow(
			"duplicate migration",
		);
		expect(() => buildMigrationLedgerInventory([...rows].reverse())).toThrow(
			"strictly increasing",
		);
		expect(() =>
			assertNoCrossDatabaseMigrationVersions({
				applicationFiles: files,
				apiFiles: [{ ...files[0], name: "api" }],
			}),
		).toThrow("versions collide");
	});

	it("rejects a source-only migration and a replay filename mismatch", () => {
		const ledger = buildMigrationLedgerInventory(rows);
		const receipt = createMigrationReplayReceipt({ files, ledger });
		expect(() =>
			compareSourceToReplay({
				sourceLedger: [
					...ledger,
					{
						...ledger[1],
						version: "20260912000200",
						name: "source_only",
					},
				],
				replayReceipt: receipt,
			}),
		).toThrow("absent from the reviewed replay");
		expect(() =>
			createMigrationReplayReceipt({
				files,
				ledger: [ledger[0], { ...ledger[1], name: "renamed" }],
			}),
		).toThrow("Migration replay mismatch");
	});

	it("collects only the exact source prefix into an immutable baseline bundle", async () => {
		const directory = await mkdtemp(join(tmpdir(), "rehearsal-migrations-"));
		try {
			await writeFile(join(directory, files[0].filename), "select 1;\n");
			await writeFile(join(directory, files[1].filename), "select 2;\n");
			const bundle = await readMigrationSourceBundle({
				directory: new URL(`file://${directory}/`),
				sourceLedger: buildMigrationLedgerInventory(rows).slice(0, 1),
			});
			expect(bundle).toHaveLength(1);
			expect(bundle[0]).toMatchObject({
				filename: files[0].filename,
				content: "select 1;\n",
			});
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});
