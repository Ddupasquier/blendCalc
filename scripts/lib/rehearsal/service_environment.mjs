/**
 * Purpose: Load an exact, project-owned allowlist of local service credentials
 * without exposing values or inheriting ambient hosted credentials.
 * Do not run directly; this module is reusable Rehearsal infrastructure.
 */

import { readFile, stat } from "node:fs/promises";
import { parseEnv } from "node:util";

const ENVIRONMENT_KEY_PATTERN = /^[A-Z][A-Z0-9_]*$/u;

export const readRehearsalServiceEnvironment = async ({
	path,
	keys = [],
	blockedKeys = [],
}) => {
	if (!path) {
		if (keys.length) {
			throw new Error(
				"Rehearsal service environment keys require an owned environment file.",
			);
		}
		return {};
	}
	if (!keys.length) {
		throw new Error(
			"A Rehearsal service environment file requires an exact variable allowlist.",
		);
	}
	for (const key of keys) {
		if (!ENVIRONMENT_KEY_PATTERN.test(key)) {
			throw new Error(`Invalid Rehearsal service environment key: ${key}.`);
		}
		if (blockedKeys.includes(key)) {
			throw new Error(
				`Rehearsal service environment key ${key} is blocked by the safety policy.`,
			);
		}
	}

	let source;
	let details;
	try {
		[details, source] = await Promise.all([stat(path), readFile(path, "utf8")]);
	} catch (error) {
		if (error?.code === "ENOENT") {
			throw new Error(
				`Rehearsal service environment file is missing: ${path}.`,
				{ cause: error },
			);
		}
		throw error;
	}
	if (!details.isFile()) {
		throw new Error(
			`Rehearsal service environment path is not a file: ${path}.`,
		);
	}
	if ((details.mode & 0o077) !== 0) {
		throw new Error(
			"Rehearsal service environment credentials must be owner-only (chmod 600).",
		);
	}

	const parsed = parseEnv(source);
	const unexpectedKeys = Object.keys(parsed).filter(
		(key) => !keys.includes(key),
	);
	if (unexpectedKeys.length) {
		throw new Error(
			`Rehearsal service environment contains variables outside its allowlist: ${unexpectedKeys.join(", ")}.`,
		);
	}
	const missingKeys = keys.filter((key) => !parsed[key]?.trim());
	if (missingKeys.length) {
		throw new Error(
			`Rehearsal service environment is missing required variables: ${missingKeys.join(", ")}.`,
		);
	}

	return Object.fromEntries(keys.map((key) => [key, parsed[key]]));
};
