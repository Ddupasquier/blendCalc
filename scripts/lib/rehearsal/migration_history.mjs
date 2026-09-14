/**
 * Purpose: Build and compare content-addressed application migration histories for
 * Rehearsal without trusting timestamp-only migration alignment. Do not run directly;
 * this module is reusable script infrastructure.
 */

import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";

const migrationNamePattern = /^(\d{14})_(.+)\.sql$/u;

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const canonicalJson = (value) => `${JSON.stringify(value, null, "\t")}\n`;

const normalizeStatement = (statement) => {
	if (typeof statement !== "string") {
		throw new Error("A Rehearsal migration ledger statement is not text.");
	}
	return statement.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
};

const assertOrderedUniqueHistory = (entries, label) => {
	const seen = new Set();
	let previous = null;
	for (const entry of entries) {
		if (!/^\d{14}$/u.test(entry.version)) {
			throw new Error(
				`${label} has an invalid migration version: ${entry.version}`,
			);
		}
		if (seen.has(entry.version)) {
			throw new Error(
				`${label} contains duplicate migration ${entry.version}.`,
			);
		}
		if (previous !== null && entry.version <= previous) {
			throw new Error(
				`${label} is not in strictly increasing migration order at ${entry.version}.`,
			);
		}
		seen.add(entry.version);
		previous = entry.version;
	}
	return entries;
};

export const readMigrationFileInventory = async (directory) => {
	const names = (await readdir(directory))
		.filter((name) => name.endsWith(".sql"))
		.sort();
	const entries = [];
	for (const filename of names) {
		const match = migrationNamePattern.exec(filename);
		if (!match) {
			throw new Error(
				`Invalid migration filename in ${directory}: ${filename}`,
			);
		}
		const bytes = await readFile(new URL(filename, directory));
		entries.push({
			version: match[1],
			name: match[2],
			filename,
			fileSha256: sha256(bytes),
		});
	}
	return assertOrderedUniqueHistory(entries, "Migration files");
};

export const readMigrationSourceBundle = async ({
	directory,
	sourceLedger,
}) => {
	assertOrderedUniqueHistory(sourceLedger, "Source migration ledger");
	const inventory = await readMigrationFileInventory(directory);
	if (sourceLedger.length > inventory.length) {
		throw new Error(
			"The source migration history contains a version absent from local migration source.",
		);
	}
	const bundle = [];
	for (let index = 0; index < sourceLedger.length; index += 1) {
		const source = sourceLedger[index];
		const file = inventory[index];
		if (source.version !== file.version || source.name !== file.name) {
			throw new Error(
				`Source migration ${source.version}_${source.name} does not match local file ${file.filename}.`,
			);
		}
		bundle.push({
			...file,
			content: await readFile(new URL(file.filename, directory), "utf8"),
		});
	}
	return bundle;
};

export const buildMigrationLedgerInventory = (
	rows,
	label = "Migration ledger",
) => {
	if (!Array.isArray(rows) || rows.length === 0) {
		throw new Error(`${label} is empty or unavailable.`);
	}
	const entries = rows.map((row) => {
		if (!row || typeof row !== "object" || typeof row.name !== "string") {
			throw new Error(`${label} contains an invalid row.`);
		}
		if (!Array.isArray(row.statements) || row.statements.length === 0) {
			throw new Error(
				`${label} migration ${row.version ?? "unknown"} has no applied statements.`,
			);
		}
		const statements = row.statements.map(normalizeStatement);
		return {
			version: String(row.version),
			name: row.name,
			statementCount: statements.length,
			statementSha256: sha256(JSON.stringify(statements)),
		};
	});
	return assertOrderedUniqueHistory(entries, label);
};

export const createMigrationReplayReceipt = ({ files, ledger }) => {
	assertOrderedUniqueHistory(files, "Migration files");
	assertOrderedUniqueHistory(ledger, "Replayed migration ledger");
	if (files.length !== ledger.length) {
		throw new Error(
			`Migration replay length mismatch: ${files.length} files but ${ledger.length} applied ledger rows.`,
		);
	}
	const entries = files.map((file, index) => {
		const applied = ledger[index];
		if (file.version !== applied.version || file.name !== applied.name) {
			throw new Error(
				`Migration replay mismatch at ${file.filename}: ledger contains ${applied.version}_${applied.name}.`,
			);
		}
		return {
			version: file.version,
			name: file.name,
			filename: file.filename,
			fileSha256: file.fileSha256,
			statementCount: applied.statementCount,
			statementSha256: applied.statementSha256,
		};
	});
	return {
		entries,
		historySha256: sha256(canonicalJson(entries)),
	};
};

export const compareSourceToReplay = ({
	sourceLedger,
	replayReceipt,
	snapshotSchemaSha256,
}) => {
	assertOrderedUniqueHistory(sourceLedger, "Source migration ledger");
	if (!replayReceipt?.entries?.length || !replayReceipt.historySha256) {
		throw new Error("The migration replay receipt is missing or invalid.");
	}
	if (sourceLedger.length > replayReceipt.entries.length) {
		throw new Error(
			"The source migration history contains a version absent from the reviewed replay.",
		);
	}
	const snapshotBacked = snapshotSchemaSha256 !== undefined;
	if (snapshotBacked && !/^[a-f0-9]{64}$/u.test(snapshotSchemaSha256)) {
		throw new Error("The production schema snapshot receipt is invalid.");
	}
	let historicalStatementDifferences = 0;
	for (let index = 0; index < sourceLedger.length; index += 1) {
		const source = sourceLedger[index];
		const replayed = replayReceipt.entries[index];
		if (source.version !== replayed.version || source.name !== replayed.name) {
			throw new Error(
				`Source migration history is not an exact replay prefix at ${source.version}_${source.name}.`,
			);
		}
		if (
			source.statementCount !== replayed.statementCount ||
			source.statementSha256 !== replayed.statementSha256
		) {
			if (!snapshotBacked) {
				throw new Error(
					`Applied statement content differs for migration ${source.version}_${source.name}.`,
				);
			}
			historicalStatementDifferences += 1;
		}
	}
	const candidates = replayReceipt.entries.slice(sourceLedger.length);
	return {
		cutoff: sourceLedger.at(-1).version,
		candidates,
		candidateSha256: sha256(canonicalJson(candidates)),
		historicalStatementDifferences,
		snapshotSchemaSha256: snapshotBacked ? snapshotSchemaSha256 : null,
	};
};

export const assertNoCrossDatabaseMigrationVersions = ({
	applicationFiles,
	apiFiles,
}) => {
	const applicationVersions = new Set(
		applicationFiles.map((entry) => entry.version),
	);
	const collisions = apiFiles
		.map((entry) => entry.version)
		.filter((version) => applicationVersions.has(version));
	if (collisions.length) {
		throw new Error(
			`Primary and secondary database migration versions collide: ${collisions.join(", ")}.`,
		);
	}
};
