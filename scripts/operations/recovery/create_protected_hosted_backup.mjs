/**
 * Purpose: Create a private logical backup of the linked production public schema,
 * public data, and every Storage object, then write SHA-256 checksums outside the repo.
 * Run: `node scripts/operations/recovery/create_protected_hosted_backup.mjs`
 * Custom destination: `node scripts/operations/recovery/create_protected_hosted_backup.mjs --output-dir=/absolute/private/path`
 * This reads production and writes local backup files; it never changes hosted data.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	chmodSync,
	createReadStream,
	mkdirSync,
	readdirSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import {
	buildMigrationManifest,
	parseLinkedMigrationList,
} from "../../lib/recovery/protectedBackup.mjs";

config({ path: ".env.moderation.local", quiet: true });
config({ path: ".env", quiet: true });

const getArgumentValue = (name) =>
	process.argv
		.slice(2)
		.find((argument) => argument.startsWith(`${name}=`))
		?.slice(name.length + 1);

const getDefaultBackupRoot = () =>
	process.platform === "darwin"
		? join(homedir(), "Library", "Application Support", "blendCalc", "backups")
		: join(homedir(), ".local", "share", "blendCalc", "backups");

const getTimestampDirectoryName = () =>
	new Date()
		.toISOString()
		.replace(/[-:]/g, "")
		.replace(/\.\d{3}Z$/, "Z");

const readDatabasePassword = () => {
	const environmentPassword = process.env.SUPABASE_DB_PASSWORD?.trim();
	if (environmentPassword) return environmentPassword;
	if (process.platform !== "darwin") return "";

	try {
		return execFileSync(
			"security",
			[
				"find-generic-password",
				"-s",
				"blendcalc-supabase-db-password",
				"-a",
				process.env.USER ?? "",
				"-w",
			],
			{
				encoding: "utf8",
				stdio: ["ignore", "pipe", "ignore"],
			},
		).trim();
	} catch {
		return "";
	}
};

const getSafeStoragePath = (backupDirectory, bucketName, objectPath) => {
	const relativeStoragePath = join("storage", bucketName, objectPath);
	const targetPath = resolve(backupDirectory, relativeStoragePath);
	const storageRoot = `${resolve(backupDirectory, "storage")}${sep}`;
	if (!targetPath.startsWith(storageRoot)) {
		throw new Error(`Unsafe Storage object path: ${bucketName}/${objectPath}`);
	}
	return targetPath;
};

const listStorageObjects = async (supabase, bucketName, prefix = "") => {
	const objects = [];
	let offset = 0;
	const pageSize = 100;

	while (true) {
		const { data, error } = await supabase.storage
			.from(bucketName)
			.list(prefix, {
				limit: pageSize,
				offset,
				sortBy: { column: "name", order: "asc" },
			});
		if (error) {
			throw new Error(
				`Unable to list Storage bucket ${bucketName}: ${error.message}`,
			);
		}
		for (const item of data ?? []) {
			const objectPath = prefix ? `${prefix}/${item.name}` : item.name;
			if (item.id === null && item.metadata === null) {
				objects.push(
					...(await listStorageObjects(supabase, bucketName, objectPath)),
				);
			} else {
				objects.push({
					path: objectPath,
					contentType:
						item.metadata?.mimetype ?? item.metadata?.contentType ?? null,
					cacheControl: item.metadata?.cacheControl ?? null,
				});
			}
		}
		if ((data?.length ?? 0) < pageSize) break;
		offset += pageSize;
	}

	return objects;
};

const hashFile = (filePath) =>
	new Promise((resolveHash, rejectHash) => {
		const hash = createHash("sha256");
		const input = createReadStream(filePath);
		input.on("data", (chunk) => hash.update(chunk));
		input.on("error", rejectHash);
		input.on("end", () => resolveHash(hash.digest("hex")));
	});

const listFiles = (directory) =>
	readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const entryPath = join(directory, entry.name);
		return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
	});

const outputRoot = resolve(
	getArgumentValue("--output-dir") ?? getDefaultBackupRoot(),
);
const backupDirectory = join(outputRoot, getTimestampDirectoryName());
const databasePassword = readDatabasePassword();
const supabaseUrl = process.env.PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!databasePassword) {
	throw new Error(
		"SUPABASE_DB_PASSWORD is unavailable from the environment or macOS Keychain.",
	);
}
if (!supabaseUrl || !serviceRoleKey) {
	throw new Error(
		"PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env.moderation.local.",
	);
}

const readLinkedMigrationVersions = () =>
	parseLinkedMigrationList(
		execFileSync(
			"supabase",
			["migration", "list", "--linked", "--output-format", "json"],
			{
				encoding: "utf8",
				stdio: ["ignore", "pipe", "inherit"],
			},
		),
	);

const migrationVersionsBeforeBackup = readLinkedMigrationVersions();

mkdirSync(backupDirectory, { recursive: true, mode: 0o700 });
chmodSync(backupDirectory, 0o700);

const schemaPath = join(backupDirectory, "public-schema.sql");
const dataPath = join(backupDirectory, "public-data.sql");

try {
	execFileSync(
		"supabase",
		[
			"db",
			"dump",
			"--linked",
			"--schema",
			"public",
			"--password",
			databasePassword,
			"--file",
			schemaPath,
		],
		{ stdio: ["ignore", "inherit", "inherit"] },
	);
	execFileSync(
		"supabase",
		[
			"db",
			"dump",
			"--linked",
			"--schema",
			"public",
			"--data-only",
			"--use-copy",
			"--password",
			databasePassword,
			"--file",
			dataPath,
		],
		{ stdio: ["ignore", "inherit", "inherit"] },
	);
	chmodSync(schemaPath, 0o600);
	chmodSync(dataPath, 0o600);

	const supabase = createClient(supabaseUrl, serviceRoleKey, {
		auth: { persistSession: false },
	});
	const { data: buckets, error: bucketError } =
		await supabase.storage.listBuckets();
	if (bucketError) {
		throw new Error(
			`Unable to list hosted Storage buckets: ${bucketError.message}`,
		);
	}

	const storageObjects = [];
	for (const bucket of buckets ?? []) {
		const bucketObjects = await listStorageObjects(supabase, bucket.name);
		for (const storageObject of bucketObjects) {
			const { data: objectData, error: downloadError } = await supabase.storage
				.from(bucket.name)
				.download(storageObject.path);
			if (downloadError || !objectData) {
				throw new Error(
					`Unable to download ${bucket.name}/${storageObject.path}: ${downloadError?.message ?? "empty response"}`,
				);
			}

			const objectPath = getSafeStoragePath(
				backupDirectory,
				bucket.name,
				storageObject.path,
			);
			mkdirSync(dirname(objectPath), { recursive: true, mode: 0o700 });
			const buffer = Buffer.from(await objectData.arrayBuffer());
			writeFileSync(objectPath, buffer, { mode: 0o600 });
			storageObjects.push({
				bucket: bucket.name,
				path: storageObject.path,
				sizeBytes: buffer.byteLength,
				sha256: createHash("sha256").update(buffer).digest("hex"),
				contentType: storageObject.contentType || objectData.type || null,
				cacheControl: storageObject.cacheControl,
			});
		}
	}

	const storageManifestPath = join(backupDirectory, "storage-manifest.json");
	writeFileSync(
		storageManifestPath,
		JSON.stringify(
			{
				createdAt: new Date().toISOString(),
				buckets: (buckets ?? []).map((bucket) => ({
					name: bucket.name,
					public: bucket.public,
					fileSizeLimit: bucket.file_size_limit,
					allowedMimeTypes: bucket.allowed_mime_types,
				})),
				objects: storageObjects,
			},
			null,
			2,
		),
		{ mode: 0o600 },
	);

	const migrationVersionsAfterBackup = readLinkedMigrationVersions();
	if (
		JSON.stringify(migrationVersionsAfterBackup) !==
		JSON.stringify(migrationVersionsBeforeBackup)
	) {
		throw new Error(
			"Hosted migration history changed while the backup was running. Retry from a stable release point.",
		);
	}
	const migrationManifestPath = join(
		backupDirectory,
		"migration-manifest.json",
	);
	writeFileSync(
		migrationManifestPath,
		JSON.stringify(
			buildMigrationManifest(migrationVersionsAfterBackup),
			null,
			2,
		),
		{ mode: 0o600 },
	);

	const checksumFiles = listFiles(backupDirectory)
		.filter((filePath) => basename(filePath) !== "SHA256SUMS")
		.map((filePath) => ({
			filePath,
			relativePath: relative(backupDirectory, filePath),
		}))
		.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
	const checksumEntries = [];
	for (const checksumFile of checksumFiles) {
		checksumEntries.push({
			...checksumFile,
			hash: await hashFile(checksumFile.filePath),
		});
	}
	const checksumPath = join(backupDirectory, "SHA256SUMS");
	writeFileSync(
		checksumPath,
		`${checksumEntries
			.map(({ hash, relativePath }) => `${hash}  ${relativePath}`)
			.join("\n")}\n`,
		{ mode: 0o600 },
	);

	const totalBytes = listFiles(backupDirectory).reduce(
		(total, filePath) => total + statSync(filePath).size,
		0,
	);
	console.log(`Protected backup created: ${backupDirectory}`);
	console.log(
		`Captured ${storageObjects.length} Storage objects; ${totalBytes.toLocaleString()} total bytes.`,
	);
} catch (error) {
	console.error(
		`Backup did not complete. Remove the incomplete directory before retrying: ${backupDirectory}`,
	);
	throw error;
}
