import { createHash } from "node:crypto";
import { createReadStream, readFileSync } from "node:fs";
import { createInterface } from "node:readline";

const MIGRATION_VERSION_PATTERN = /^\d{14}$/;
const COPY_HEADER_PATTERN =
	/^COPY (?:(?:"public"\."([^"]+)")|(?:public\.(?:"([^"]+)"|([a-zA-Z0-9_]+)))) \(.+\) FROM stdin;$/;

export const parseLinkedMigrationList = (output) => {
	const parsed = JSON.parse(output);
	const migrations = (parsed.migrations ?? [])
		.map((migration) => migration.remote)
		.filter((version) => typeof version === "string" && version.length > 0);
	if (
		migrations.length === 0 ||
		migrations.some((version) => !MIGRATION_VERSION_PATTERN.test(version))
	) {
		throw new Error("The linked migration list is empty or invalid.");
	}
	return migrations;
};

export const buildMigrationManifest = (
	migrationVersions,
	createdAt = new Date().toISOString(),
) => {
	const migrations = [...new Set(migrationVersions)].sort();
	if (
		migrations.length === 0 ||
		migrations.some((version) => !MIGRATION_VERSION_PATTERN.test(version))
	) {
		throw new Error(
			"Cannot create a backup manifest from invalid migration versions.",
		);
	}
	return {
		createdAt,
		latestMigrationVersion: migrations.at(-1),
		migrations,
	};
};

export const validateMigrationManifest = (manifest) => {
	if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
		throw new Error("Migration manifest must be an object.");
	}
	const migrations = manifest.migrations;
	if (
		!Array.isArray(migrations) ||
		migrations.length === 0 ||
		migrations.some((version) => !MIGRATION_VERSION_PATTERN.test(version)) ||
		manifest.latestMigrationVersion !== migrations.at(-1)
	) {
		throw new Error(
			"Migration manifest does not contain a valid ordered migration history.",
		);
	}
	const sorted = [...new Set(migrations)].sort();
	if (JSON.stringify(sorted) !== JSON.stringify(migrations)) {
		throw new Error("Migration manifest versions must be unique and ordered.");
	}
	return manifest;
};

export const readMigrationCutoff = (backupDirectory, legacyCutoff) => {
	try {
		const manifest = validateMigrationManifest(
			JSON.parse(
				readFileSync(`${backupDirectory}/migration-manifest.json`, "utf8"),
			),
		);
		return {
			migrationVersions: manifest.migrations,
			migrationCutoff: manifest.latestMigrationVersion,
			usedLegacyCutoff: false,
		};
	} catch (error) {
		if (error?.code !== "ENOENT") throw error;
		if (!MIGRATION_VERSION_PATTERN.test(legacyCutoff ?? "")) {
			throw new Error(
				"This legacy backup has no migration manifest. Pass --legacy-migration-cutoff=<14-digit-version> after independently verifying its schema point.",
				{ cause: error },
			);
		}
		return {
			migrationVersions: null,
			migrationCutoff: legacyCutoff,
			usedLegacyCutoff: true,
		};
	}
};

export const readCopyRowCounts = async (dataPath) => {
	const rowCounts = new Map();
	let activeTable = null;
	let activeCount = 0;
	const lines = createInterface({
		input: createReadStream(dataPath),
		crlfDelay: Infinity,
	});
	for await (const line of lines) {
		if (activeTable) {
			if (line === "\\.") {
				rowCounts.set(activeTable, activeCount);
				activeTable = null;
				activeCount = 0;
			} else {
				activeCount += 1;
			}
			continue;
		}
		const match = line.match(COPY_HEADER_PATTERN);
		if (match) activeTable = match[1] ?? match[2] ?? match[3];
	}
	if (activeTable)
		throw new Error(`Unterminated COPY block for public.${activeTable}.`);
	return rowCounts;
};

export const hashFile = (filePath) =>
	new Promise((resolveHash, rejectHash) => {
		const hash = createHash("sha256");
		const input = createReadStream(filePath);
		input.on("data", (chunk) => hash.update(chunk));
		input.on("error", rejectHash);
		input.on("end", () => resolveHash(hash.digest("hex")));
	});
