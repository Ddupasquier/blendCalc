/**
 * Purpose: Load or create the private machine-local key that keeps BlendCalc-specific
 * Rehearsal pseudonyms stable across baseline refreshes. Do not run directly.
 */

import { randomBytes } from "node:crypto";
import { chmod, lstat, mkdir, open, readFile } from "node:fs/promises";
import { basename, join, resolve, sep } from "node:path";

const keyFilename = "sanitization.key";
const keyBytes = 32;

const assertArtifactRoot = (artifactRoot) => {
	const resolved = resolve(artifactRoot);
	if (basename(resolved) !== ".rehearsal" || resolved === sep) {
		throw new Error(
			`Refusing an unsafe Rehearsal artifact root: ${artifactRoot}`,
		);
	}
	return resolved;
};

const readExistingKey = async (path) => {
	const stats = await lstat(path);
	if (!stats.isFile() || stats.isSymbolicLink()) {
		throw new Error("The Rehearsal sanitization key must be a regular file.");
	}
	if ((stats.mode & 0o077) !== 0) {
		throw new Error(
			"The Rehearsal sanitization key must not be accessible by group or other users.",
		);
	}
	const key = await readFile(path);
	if (key.length !== keyBytes) {
		key.fill(0);
		throw new Error("The Rehearsal sanitization key must contain 32 bytes.");
	}
	return key;
};

export const loadOrCreateSanitizationKey = async ({ artifactRoot }) => {
	const root = assertArtifactRoot(artifactRoot);
	await mkdir(root, { recursive: true, mode: 0o700 });
	const path = join(root, keyFilename);
	try {
		return await readExistingKey(path);
	} catch (error) {
		if (error?.code !== "ENOENT") throw error;
	}

	const key = randomBytes(keyBytes);
	let handle;
	try {
		handle = await open(path, "wx", 0o600);
		await handle.writeFile(key);
		await handle.sync();
		await handle.close();
		handle = null;
		await chmod(path, 0o600);
		return key;
	} catch (error) {
		await handle?.close().catch(() => undefined);
		key.fill(0);
		if (error?.code === "EEXIST") return readExistingKey(path);
		throw error;
	}
};
