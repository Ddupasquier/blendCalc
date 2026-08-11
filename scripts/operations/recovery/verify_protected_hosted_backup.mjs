/**
 * Purpose: Verify private backup permissions, required database artifacts, Storage
 * manifest coverage, and SHA-256 checksums without contacting or changing Supabase.
 * Run: `node scripts/operations/recovery/verify_protected_hosted_backup.mjs /absolute/path/to/backup`
 */

import { createHash } from "node:crypto";
import { createReadStream, readFileSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

const backupArgument = process.argv[2];
if (!backupArgument || !isAbsolute(backupArgument)) {
	throw new Error("Pass the absolute path to a protected backup directory.");
}

const backupDirectory = resolve(backupArgument);
const backupDirectoryMode = statSync(backupDirectory).mode & 0o777;
if ((backupDirectoryMode & 0o077) !== 0) {
	throw new Error("Backup directory permissions must deny group and public access.");
}

const getSafeBackupPath = (relativePath) => {
	const targetPath = resolve(backupDirectory, relativePath);
	if (!targetPath.startsWith(`${backupDirectory}${sep}`)) {
		throw new Error(`Unsafe checksum path: ${relativePath}`);
	}
	return targetPath;
};

const hashFile = (filePath) =>
	new Promise((resolveHash, rejectHash) => {
		const hash = createHash("sha256");
		const input = createReadStream(filePath);
		input.on("data", (chunk) => hash.update(chunk));
		input.on("error", rejectHash);
		input.on("end", () => resolveHash(hash.digest("hex")));
	});

const requiredFiles = [
	"public-schema.sql",
	"public-data.sql",
	"storage-manifest.json",
	"SHA256SUMS",
];
for (const relativePath of requiredFiles) {
	const filePath = getSafeBackupPath(relativePath);
	const fileStats = statSync(filePath);
	if (!fileStats.isFile() || fileStats.size === 0) {
		throw new Error(`Required backup file is empty or invalid: ${relativePath}`);
	}
	if ((fileStats.mode & 0o077) !== 0) {
		throw new Error(`Backup file permissions are too broad: ${relativePath}`);
	}
}

const checksumLines = readFileSync(
	join(backupDirectory, "SHA256SUMS"),
	"utf8",
)
	.split("\n")
	.filter(Boolean);
const checksums = new Map(
	checksumLines.map((line) => {
		const match = line.match(/^([a-f0-9]{64})  (.+)$/);
		if (!match) throw new Error(`Invalid SHA256SUMS entry: ${line}`);
		const listedPath = match[2];
		const normalizedPath = isAbsolute(listedPath)
			? relative(backupDirectory, getSafeBackupPath(listedPath))
			: listedPath;
		return [normalizedPath, match[1]];
	}),
);

for (const [relativePath, expectedHash] of checksums) {
	const filePath = getSafeBackupPath(relativePath);
	const actualHash = await hashFile(filePath);
	if (actualHash !== expectedHash) {
		throw new Error(`Checksum mismatch: ${relativePath}`);
	}
}

const storageManifest = JSON.parse(
	readFileSync(join(backupDirectory, "storage-manifest.json"), "utf8"),
);
for (const storageObject of storageManifest.objects ?? []) {
	const bucketName = storageObject.bucket ?? storageObject.bucketId;
	const objectPath = storageObject.path ?? storageObject.objectPath;
	const sizeBytes = storageObject.sizeBytes ?? storageObject.bytes;
	if (!bucketName || !objectPath || !Number.isFinite(sizeBytes)) {
		throw new Error("Storage manifest contains an incomplete object entry.");
	}
	const relativePath = join(
		"storage",
		bucketName,
		objectPath,
	);
	const filePath = getSafeBackupPath(relativePath);
	const fileStats = statSync(filePath);
	if (fileStats.size !== sizeBytes) {
		throw new Error(`Storage size mismatch: ${relativePath}`);
	}
	if (checksums.get(relativePath) !== storageObject.sha256) {
		throw new Error(`Storage manifest checksum mismatch: ${relativePath}`);
	}
}

console.log(
	`Protected backup verified: ${checksums.size} files, ${(storageManifest.objects ?? []).length} Storage objects.`,
);
