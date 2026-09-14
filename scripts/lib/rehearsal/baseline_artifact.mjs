/**
 * Purpose: Write, verify, and atomically activate immutable sanitized Rehearsal
 * baseline generations. Do not run directly; this module is reusable script
 * infrastructure.
 */

import { createHash, randomBytes } from "node:crypto";
import {
	chmod,
	lstat,
	mkdir,
	open,
	readFile,
	readdir,
	readlink,
	rename,
	rm,
	symlink,
} from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { createMigrationReplayReceipt } from "./migration_history.mjs";

const generationPattern = /^\d{8}T\d{6}Z-[a-f0-9]{12}$/u;
const buildPrefix = ".building-";
const generationsDirectoryName = "generations";
const currentLinkName = "current";
const migrationNamePattern = /^\d{14}_[a-z0-9_]+\.sql$/u;
const storageBucketPattern = /^[a-z0-9][a-z0-9.-]{0,99}$/u;
const maximumAssetBytes = 50 * 1024 * 1024;
const maximumTotalAssetBytes = 2 * 1024 * 1024 * 1024;

const canonicalJson = (value) => `${JSON.stringify(value, null, "\t")}\n`;

const assertGenerationId = (value) => {
	if (!generationPattern.test(value)) {
		throw new Error(
			`Invalid Rehearsal baseline generation identifier: ${value}`,
		);
	}
	return value;
};

const assertArtifactRoot = (artifactRoot) => {
	const resolved = resolve(artifactRoot);
	if (basename(resolved) !== ".rehearsal" || resolved === sep) {
		throw new Error(
			`Refusing an unsafe Rehearsal artifact root: ${artifactRoot}`,
		);
	}
	return resolved;
};

const pathInside = (parent, child) => {
	const childRelative = relative(parent, child);
	return (
		childRelative !== "" &&
		!childRelative.startsWith(`..${sep}`) &&
		childRelative !== ".." &&
		!childRelative.startsWith(sep)
	);
};

const assertInsideRoot = (root, target) => {
	if (!pathInside(root, target)) {
		throw new Error(`Rehearsal artifact path escaped its root: ${target}`);
	}
	return target;
};

const writeImmutableFile = async (path, content) => {
	const handle = await open(path, "wx", 0o600);
	try {
		await handle.writeFile(content);
		await handle.sync();
	} finally {
		await handle.close();
	}
	await chmod(path, 0o400);
};

const assetRelativePath = (bucket, objectPath) => {
	if (!storageBucketPattern.test(bucket)) {
		throw new Error(`Invalid Rehearsal Storage bucket: ${bucket}.`);
	}
	const segments = objectPath.split("/");
	if (
		!objectPath ||
		segments.some((segment) => !segment || segment === "." || segment === "..")
	) {
		throw new Error(`Invalid Rehearsal Storage object path: ${objectPath}.`);
	}
	return join(
		"storage",
		encodeURIComponent(bucket),
		...segments.map(encodeURIComponent),
	);
};

const verifyNoSymlink = async (path, label) => {
	try {
		const stats = await lstat(path);
		if (stats.isSymbolicLink()) {
			throw new Error(`${label} may not be a symbolic link.`);
		}
	} catch (error) {
		if (error?.code !== "ENOENT") throw error;
	}
};

const makeArtifactTreeWritable = async (path) => {
	await chmod(path, 0o700).catch(() => undefined);
	for (const entry of await readdir(path, { withFileTypes: true }).catch(
		() => [],
	)) {
		const child = join(path, entry.name);
		if (entry.isDirectory()) await makeArtifactTreeWritable(child);
		else if (!entry.isSymbolicLink()) await chmod(child, 0o600);
	}
};

export const createBaselineGenerationId = ({ now = new Date() } = {}) => {
	const timestamp = now
		.toISOString()
		.replace(/\.\d{3}Z$/u, "Z")
		.replaceAll("-", "")
		.replaceAll(":", "");
	return `${timestamp}-${randomBytes(6).toString("hex")}`;
};

export const createAndActivateBaseline = async ({
	artifactRoot,
	generationId = createBaselineGenerationId(),
	records,
	metadata,
	expectedTables = [],
	migrationFiles = [],
	assets = [],
	schemaSql = null,
}) => {
	const root = assertArtifactRoot(artifactRoot);
	assertGenerationId(generationId);
	if (!records?.[Symbol.asyncIterator] && !records?.[Symbol.iterator]) {
		throw new Error(
			"A Rehearsal baseline requires an iterable sanitized record stream.",
		);
	}
	if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
		throw new Error("A Rehearsal baseline requires explicit metadata.");
	}
	if (
		!Array.isArray(expectedTables) ||
		expectedTables.some((name) => !/^[a-z][a-z0-9_]*$/u.test(name)) ||
		new Set(expectedTables).size !== expectedTables.length
	) {
		throw new Error(
			"Rehearsal expected table names are invalid or duplicated.",
		);
	}
	const expectedTableSet = new Set(expectedTables);
	await verifyNoSymlink(root, "The Rehearsal artifact root");
	await mkdir(root, { recursive: true, mode: 0o700 });
	const generationsRoot = assertInsideRoot(
		root,
		join(root, generationsDirectoryName),
	);
	await verifyNoSymlink(generationsRoot, "The Rehearsal generations directory");
	await mkdir(generationsRoot, { recursive: true, mode: 0o700 });

	const finalDirectory = assertInsideRoot(
		root,
		join(generationsRoot, generationId),
	);
	const buildDirectory = assertInsideRoot(
		root,
		join(
			root,
			`${buildPrefix}${generationId}-${randomBytes(4).toString("hex")}`,
		),
	);
	const dataPath = join(buildDirectory, "sanitized-data.ndjson");
	let dataHandle;
	let finalCreated = false;
	let rowCount = 0;
	const tableCounts = new Map(expectedTables.map((name) => [name, 0]));
	const dataHash = createHash("sha256");

	try {
		await mkdir(buildDirectory, { mode: 0o700 });
		dataHandle = await open(dataPath, "wx", 0o600);
		for await (const record of records) {
			if (
				!record ||
				typeof record.table !== "string" ||
				!record.row ||
				typeof record.row !== "object" ||
				Array.isArray(record.row)
			) {
				throw new Error("A sanitized baseline record has an invalid shape.");
			}
			if (expectedTableSet.size && !expectedTableSet.has(record.table)) {
				throw new Error(
					`The baseline stream exposed unexpected table ${record.table}.`,
				);
			}
			const line = `${JSON.stringify(record)}\n`;
			dataHash.update(line);
			await dataHandle.write(line, null, "utf8");
			rowCount += 1;
			tableCounts.set(record.table, (tableCounts.get(record.table) ?? 0) + 1);
		}
		await dataHandle.sync();
		await dataHandle.close();
		dataHandle = null;
		await chmod(dataPath, 0o400);
		let schemaReceipt;
		if (schemaSql !== null) {
			if (typeof schemaSql !== "string" || schemaSql.length === 0) {
				throw new Error("A Rehearsal production schema snapshot is invalid.");
			}
			const schemaPath = join(buildDirectory, "production-schema.sql");
			await writeImmutableFile(schemaPath, schemaSql);
			schemaReceipt = {
				sha256: createHash("sha256").update(schemaSql).digest("hex"),
				bytes: Buffer.byteLength(schemaSql),
			};
		}

		const resolvedMigrationFiles =
			typeof migrationFiles === "function"
				? await migrationFiles()
				: await migrationFiles;
		if (!Array.isArray(resolvedMigrationFiles)) {
			throw new Error("Rehearsal migration source must be an array.");
		}
		if (!/^[a-f0-9]{64}$/u.test(metadata.migrationHistorySha256 ?? "")) {
			throw new Error(
				"A Rehearsal baseline requires a migration-history SHA-256.",
			);
		}
		if (metadata.sourceMigrationHistory) {
			const migrationReceipt = createMigrationReplayReceipt({
				files: resolvedMigrationFiles,
				ledger: metadata.sourceMigrationHistory,
			});
			if (migrationReceipt.historySha256 !== metadata.migrationHistorySha256) {
				throw new Error(
					"The Rehearsal baseline migration-history SHA-256 is invalid.",
				);
			}
		}
		const migrationDirectory = join(buildDirectory, "migrations");
		await mkdir(migrationDirectory, { mode: 0o700 });
		const migrationManifest = {};
		for (const migration of resolvedMigrationFiles) {
			if (
				!migration ||
				!migrationNamePattern.test(migration.filename) ||
				typeof migration.content !== "string" ||
				Object.hasOwn(migrationManifest, migration.filename)
			) {
				throw new Error("A Rehearsal migration bundle entry is invalid.");
			}
			const contentHash = createHash("sha256")
				.update(migration.content)
				.digest("hex");
			if (migration.fileSha256 && migration.fileSha256 !== contentHash) {
				throw new Error(
					`Rehearsal migration source checksum mismatch for ${migration.filename}.`,
				);
			}
			await writeImmutableFile(
				join(migrationDirectory, migration.filename),
				migration.content,
			);
			migrationManifest[migration.filename] = { sha256: contentHash };
		}
		await chmod(migrationDirectory, 0o500);

		const assetManifest = {};
		let totalAssetBytes = 0;
		for await (const asset of assets) {
			if (
				!asset ||
				typeof asset.bucket !== "string" ||
				typeof asset.objectPath !== "string" ||
				(!asset.content?.[Symbol.asyncIterator] &&
					!asset.content?.[Symbol.iterator] &&
					!Buffer.isBuffer(asset.content))
			) {
				throw new Error("A Rehearsal Storage asset has an invalid shape.");
			}
			const relativePath = assetRelativePath(asset.bucket, asset.objectPath);
			if (Object.hasOwn(assetManifest, relativePath)) {
				throw new Error(`Duplicate Rehearsal Storage asset: ${relativePath}.`);
			}
			const target = assertInsideRoot(
				buildDirectory,
				join(buildDirectory, relativePath),
			);
			await mkdir(dirname(target), { recursive: true, mode: 0o700 });
			const handle = await open(target, "wx", 0o600);
			const hash = createHash("sha256");
			let bytes = 0;
			try {
				const chunks = Buffer.isBuffer(asset.content)
					? [asset.content]
					: asset.content;
				for await (const chunk of chunks) {
					const buffer = Buffer.from(chunk);
					bytes += buffer.length;
					totalAssetBytes += buffer.length;
					if (
						bytes > maximumAssetBytes ||
						totalAssetBytes > maximumTotalAssetBytes
					) {
						throw new Error(
							"The Rehearsal Storage asset boundary was exceeded.",
						);
					}
					hash.update(buffer);
					await handle.write(buffer);
				}
				await handle.sync();
			} finally {
				await handle.close();
			}
			await chmod(target, 0o400);
			assetManifest[relativePath] = {
				sha256: hash.digest("hex"),
				bytes,
				bucket: asset.bucket,
				objectPath: asset.objectPath,
				contentType: asset.contentType ?? "application/octet-stream",
			};
		}

		const manifest = {
			...metadata,
			formatVersion: schemaReceipt ? 2 : 1,
			generationId,
			rowCount,
			tableCounts: Object.fromEntries([...tableCounts].sort()),
			files: {
				"sanitized-data.ndjson": {
					sha256: dataHash.digest("hex"),
					rows: rowCount,
				},
				...(schemaReceipt ? { "production-schema.sql": schemaReceipt } : {}),
			},
			storageAssets: assetManifest,
			migrations: migrationManifest,
		};
		await writeImmutableFile(
			join(buildDirectory, "baseline-manifest.json"),
			canonicalJson(manifest),
		);
		await rename(buildDirectory, finalDirectory);
		finalCreated = true;
		await chmod(finalDirectory, 0o500);

		const temporaryLink = assertInsideRoot(
			root,
			join(root, `.current-${randomBytes(4).toString("hex")}`),
		);
		await symlink(join(generationsDirectoryName, generationId), temporaryLink);
		await rename(temporaryLink, join(root, currentLinkName));
		return manifest;
	} catch (error) {
		if (dataHandle) await dataHandle.close().catch(() => undefined);
		await chmod(buildDirectory, 0o700).catch(() => undefined);
		await rm(buildDirectory, { recursive: true, force: true });
		if (finalCreated) {
			await chmod(finalDirectory, 0o700).catch(() => undefined);
			await rm(finalDirectory, { recursive: true, force: true });
		}
		throw error;
	}
};

export const resolveActiveBaselinePaths = async ({ artifactRoot }) => {
	const root = assertArtifactRoot(artifactRoot);
	const currentTarget = await readlink(join(root, currentLinkName));
	const generationDirectory = resolve(root, currentTarget);
	assertInsideRoot(root, generationDirectory);
	if (dirname(generationDirectory) !== join(root, generationsDirectoryName)) {
		throw new Error(
			"The active Rehearsal baseline points outside generations.",
		);
	}
	return {
		artifactRoot: root,
		generationDirectory,
		dataPath: join(generationDirectory, "sanitized-data.ndjson"),
		manifestPath: join(generationDirectory, "baseline-manifest.json"),
		migrationsDirectory: join(generationDirectory, "migrations"),
		schemaPath: join(generationDirectory, "production-schema.sql"),
	};
};

export const verifyActiveBaseline = async ({ artifactRoot }) => {
	const paths = await resolveActiveBaselinePaths({ artifactRoot });
	const { generationDirectory } = paths;
	const manifest = JSON.parse(await readFile(paths.manifestPath, "utf8"));
	assertGenerationId(manifest.generationId);
	if (basename(generationDirectory) !== manifest.generationId) {
		throw new Error(
			"The active Rehearsal baseline identifier does not match its path.",
		);
	}
	const data = await readFile(paths.dataPath);
	const actualHash = createHash("sha256").update(data).digest("hex");
	if (actualHash !== manifest.files?.["sanitized-data.ndjson"]?.sha256) {
		throw new Error("The active Rehearsal baseline data checksum is invalid.");
	}
	if (manifest.files?.["production-schema.sql"]) {
		const schema = await readFile(paths.schemaPath);
		const receipt = manifest.files["production-schema.sql"];
		if (
			schema.length !== receipt.bytes ||
			createHash("sha256").update(schema).digest("hex") !== receipt.sha256
		) {
			throw new Error(
				"The active Rehearsal production schema checksum is invalid.",
			);
		}
	}
	const migrationDirectory = paths.migrationsDirectory;
	const expectedMigrationNames = Object.keys(manifest.migrations ?? {}).sort();
	const actualMigrationNames = (await readdir(migrationDirectory)).sort();
	if (expectedMigrationNames.join("\0") !== actualMigrationNames.join("\0")) {
		throw new Error("The active Rehearsal migration bundle is not exact.");
	}
	for (const filename of expectedMigrationNames) {
		if (!migrationNamePattern.test(filename)) {
			throw new Error("The active Rehearsal migration manifest is invalid.");
		}
		const migrationHash = createHash("sha256")
			.update(await readFile(join(migrationDirectory, filename)))
			.digest("hex");
		if (migrationHash !== manifest.migrations[filename]?.sha256) {
			throw new Error(
				`The active Rehearsal migration checksum is invalid for ${filename}.`,
			);
		}
	}
	for (const [relativePath, receipt] of Object.entries(
		manifest.storageAssets ?? {},
	)) {
		if (
			relativePath !== assetRelativePath(receipt.bucket, receipt.objectPath)
		) {
			throw new Error("The active Rehearsal Storage manifest path is invalid.");
		}
		const assetPath = assertInsideRoot(
			generationDirectory,
			join(generationDirectory, relativePath),
		);
		const asset = await readFile(assetPath);
		if (
			asset.length !== receipt.bytes ||
			createHash("sha256").update(asset).digest("hex") !== receipt.sha256
		) {
			throw new Error(
				`The active Rehearsal Storage checksum is invalid for ${relativePath}.`,
			);
		}
	}
	return manifest;
};

export const listIncompleteBaselineBuilds = async ({ artifactRoot }) => {
	const root = assertArtifactRoot(artifactRoot);
	try {
		return (await readdir(root)).filter((name) => name.startsWith(buildPrefix));
	} catch (error) {
		if (error?.code === "ENOENT") return [];
		throw error;
	}
};

export const pruneBaselineGenerations = async ({
	artifactRoot,
	retain = 2,
}) => {
	const root = assertArtifactRoot(artifactRoot);
	if (!Number.isSafeInteger(retain) || retain < 1) {
		throw new Error("Rehearsal baseline retention must be a positive integer.");
	}
	const active = await resolveActiveBaselinePaths({ artifactRoot: root });
	const generationsRoot = join(root, generationsDirectoryName);
	await verifyNoSymlink(generationsRoot, "The Rehearsal generations directory");
	const entries = await readdir(generationsRoot, { withFileTypes: true });
	for (const entry of entries) {
		if (
			!entry.isDirectory() ||
			entry.isSymbolicLink() ||
			!generationPattern.test(entry.name)
		) {
			throw new Error(
				`Refusing to prune an unexpected Rehearsal generation entry: ${entry.name}`,
			);
		}
	}
	const activeName = basename(active.generationDirectory);
	const retained = new Set(
		[
			activeName,
			...entries
				.map((entry) => entry.name)
				.sort()
				.reverse(),
		]
			.filter((name, index, values) => values.indexOf(name) === index)
			.slice(0, retain),
	);
	const removed = entries
		.map((entry) => entry.name)
		.filter((name) => !retained.has(name));
	for (const name of removed) {
		const target = assertInsideRoot(
			generationsRoot,
			join(generationsRoot, name),
		);
		await verifyNoSymlink(target, "A Rehearsal baseline generation");
		await makeArtifactTreeWritable(target);
		await rm(target, { recursive: true, force: true });
	}
	return { retained: [...retained], removed };
};

export const removeBaselineArtifactRoot = async ({ artifactRoot }) => {
	const root = assertArtifactRoot(artifactRoot);
	await verifyNoSymlink(root, "The Rehearsal artifact root");
	await makeArtifactTreeWritable(root);
	await rm(root, { recursive: true, force: true });
};
