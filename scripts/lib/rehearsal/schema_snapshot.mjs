/**
 * Purpose: Capture and compare bounded, data-free PostgreSQL public-schema
 * snapshots for a local Rehearsal runtime. Do not run directly.
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { basename, join, resolve, sep } from "node:path";
import { createCleanProcessEnvironment } from "./process_environment.mjs";

const maximumSchemaBytes = 64 * 1024 * 1024;

const assertArtifactRoot = (artifactRoot) => {
	const resolved = resolve(artifactRoot);
	if (basename(resolved) !== ".rehearsal" || resolved === sep) {
		throw new Error(
			`Refusing an unsafe Rehearsal artifact root: ${artifactRoot}`,
		);
	}
	return resolved;
};

export const assertProductionSchemaDump = (schemaSql) => {
	if (typeof schemaSql !== "string" || schemaSql.length === 0) {
		throw new Error("The Rehearsal production schema snapshot is empty.");
	}
	if (Buffer.byteLength(schemaSql) > maximumSchemaBytes) {
		throw new Error("The Rehearsal production schema snapshot is too large.");
	}
	if (!schemaSql.includes('CREATE SCHEMA IF NOT EXISTS "public";')) {
		throw new Error(
			"The Rehearsal production schema snapshot does not define public.",
		);
	}
	if (/^COPY\s|^\\connect\s|^CREATE DATABASE\s/mu.test(schemaSql)) {
		throw new Error(
			"The Rehearsal production schema snapshot contains data or database switching commands.",
		);
	}
	return schemaSql;
};

const comparableSchemaDump = (schemaSql) =>
	assertProductionSchemaDump(schemaSql)
		.split("\n")
		.map((line) => line.trimEnd())
		.filter(Boolean)
		.map((line) => {
			const checkConstraint = line.match(
				/^(\s*CONSTRAINT "[^"]+" CHECK ).*(,?)$/u,
			);
			return checkConstraint
				? `${checkConstraint[1]}<database-normalized-expression>${checkConstraint[2]}`
				: line;
		})
		.join("\n");

export const compareProductionSchemaDumps = ({ expected, actual }) => {
	const expectedComparable = comparableSchemaDump(expected);
	const actualComparable = comparableSchemaDump(actual);
	if (expectedComparable !== actualComparable) {
		throw new Error(
			"The local Rehearsal public schema does not structurally match the production snapshot.",
		);
	}
	return createHash("sha256").update(actualComparable).digest("hex");
};

export const captureSupabasePublicSchema = async ({
	repositoryRoot,
	artifactRoot,
	arguments_,
}) => {
	const root = assertArtifactRoot(artifactRoot);
	await mkdir(root, { recursive: true, mode: 0o700 });
	const temporaryDirectory = await mkdtemp(join(root, ".schema-capture-"));
	const destination = join(temporaryDirectory, "production-schema.sql");
	try {
		const result = spawnSync(
			"supabase",
			[...arguments_, "--schema", "public", "--file", destination],
			{
				cwd: repositoryRoot,
				env: createCleanProcessEnvironment(),
				encoding: "utf8",
				stdio: ["ignore", "pipe", "pipe"],
				maxBuffer: 4 * 1024 * 1024,
			},
		);
		if (result.error || result.status !== 0) {
			throw new Error(
				"The exact Rehearsal schema snapshot could not be captured.",
				{ cause: result.error },
			);
		}
		await chmod(destination, 0o600);
		return assertProductionSchemaDump(await readFile(destination, "utf8"));
	} finally {
		await rm(temporaryDirectory, { recursive: true, force: true });
	}
};

export const captureLocalPublicSchema = ({
	repositoryRoot,
	artifactRoot,
	workdir,
}) =>
	captureSupabasePublicSchema({
		repositoryRoot,
		artifactRoot,
		arguments_: ["db", "dump", "--local", "--workdir", workdir],
	});
