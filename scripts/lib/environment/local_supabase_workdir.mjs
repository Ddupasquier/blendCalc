/**
 * Purpose: Stage public Supabase inputs separately from hosted CLI link metadata.
 * Do not run directly; local database commands own this generated, ignored workdir.
 */

import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
	existsSync,
	lstatSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { createCleanProcessEnvironment } from "./runtime_environment.mjs";

const markerName = ".blendcalc-local-inputs.json";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const safeInputName = (name) =>
	/^(?:config\.toml|seed\.sql|(?:migrations|tests|templates)\/[A-Za-z0-9_./-]+\.(?:sql|html))$/.test(
		name,
	) && !name.split(/[\\/]/).includes("..");

export const getCanonicalLocalRepositoryRoot = (cwd) => {
	const common = execFileSync(
		"git",
		["rev-parse", "--path-format=absolute", "--git-common-dir"],
		{
			cwd,
			encoding: "utf8",
			env: createCleanProcessEnvironment(),
			stdio: ["ignore", "pipe", "ignore"],
		},
	).trim();
	if (!common.endsWith(`${sep}.git`)) {
		throw new Error(
			"Local database state requires a normal repository checkout.",
		);
	}
	return dirname(common);
};

const ensureDirectory = (path) => {
	if (existsSync(path)) {
		if (!lstatSync(path).isDirectory() || lstatSync(path).isSymbolicLink()) {
			throw new Error("Refusing a symlink or non-directory local state path.");
		}
	} else mkdirSync(path, { mode: 0o700 });
};

const readPublicInputs = (source) => {
	if (!lstatSync(source).isDirectory() || lstatSync(source).isSymbolicLink())
		throw new Error("Public Supabase source must be a regular directory.");
	const files = new Map();
	let totalBytes = 0;
	const add = (path, name) => {
		if (!safeInputName(name))
			throw new Error("Unsupported local public input path.");
		const stat = lstatSync(path);
		if (
			!stat.isFile() ||
			stat.isSymbolicLink() ||
			stat.size > 16 * 1024 * 1024
		) {
			throw new Error(
				"Local Supabase inputs must be bounded regular public files.",
			);
		}
		if (files.size >= 4096 || totalBytes + stat.size > 128 * 1024 * 1024)
			throw new Error("Local Supabase public input bounds exceeded.");
		totalBytes += stat.size;
		files.set(name, readFileSync(path));
	};
	add(join(source, "config.toml"), "config.toml");
	if (existsSync(join(source, "seed.sql")))
		add(join(source, "seed.sql"), "seed.sql");
	const walk = (directory, extension, depth = 0) => {
		if (depth > 16) throw new Error("Local public input depth exceeded.");
		if (!existsSync(directory)) return;
		if (lstatSync(directory).isSymbolicLink())
			throw new Error("Refusing symlinked public inputs.");
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const path = join(directory, entry.name);
			if (entry.isSymbolicLink())
				throw new Error("Refusing symlinked public inputs.");
			if (entry.isDirectory()) walk(path, extension, depth + 1);
			else if (entry.name.endsWith(extension))
				add(path, relative(source, path));
		}
	};
	for (const [name, extension] of [
		["migrations", ".sql"],
		["tests", ".sql"],
		["templates", ".html"],
	]) {
		walk(join(source, name), extension);
	}
	return files;
};

const validateParents = (root, name) => {
	let directory = root;
	for (const segment of name.split(sep).slice(0, -1)) {
		directory = join(directory, segment);
		if (
			existsSync(directory) &&
			(!lstatSync(directory).isDirectory() ||
				lstatSync(directory).isSymbolicLink())
		) {
			throw new Error("Refusing unsafe local input parent directories.");
		}
	}
};

/** Derived copies are not editable authorities; .temp and environment files never copy. */
export const prepareLocalSupabaseWorkdir = ({
	cwd = process.cwd(),
	workdir = ".",
	canonicalRoot = getCanonicalLocalRepositoryRoot(cwd),
	refreshInputs = true,
	assertConfigurationChangeSafe = () => {
		throw new Error(
			"Stop the local stack before changing its config or templates.",
		);
	},
} = {}) => {
	const source = resolve(cwd, workdir, "supabase");
	const inputs = readPublicInputs(source);
	const projectId = inputs
		.get("config.toml")
		.toString("utf8")
		.match(/^project_id\s*=\s*"([A-Za-z0-9][A-Za-z0-9_-]{0,62})"\s*$/m)?.[1];
	if (!projectId)
		throw new Error("Local Supabase config requires an exact safe project id.");
	const cache = join(canonicalRoot, ".cache");
	const local = join(cache, "local-supabase");
	const runtime = join(local, projectId);
	for (const directory of [cache, local, runtime]) ensureDirectory(directory);
	const lockName = ".input-preparation.lock";
	const lock = join(runtime, lockName);
	try {
		writeFileSync(lock, `${process.pid}\n`, { flag: "wx", mode: 0o600 });
	} catch {
		throw new Error(
			"Local input preparation is already locked; preserve it until the owner exits.",
		);
	}
	try {
		const marker = join(runtime, markerName);
		if (
			!existsSync(marker) &&
			readdirSync(runtime).some((name) => name !== lockName)
		) {
			throw new Error("Refusing an unowned local Supabase state directory.");
		}
		if (
			existsSync(marker) &&
			(lstatSync(marker).isSymbolicLink() ||
				!lstatSync(marker).isFile() ||
				lstatSync(marker).size > 1024 * 1024)
		) {
			throw new Error("Local state receipt must be a bounded regular file.");
		}
		let prior;
		try {
			prior = existsSync(marker)
				? JSON.parse(readFileSync(marker, "utf8"))
				: { version: 1, projectId, files: {} };
		} catch {
			throw new Error("Local state receipt could not be validated.");
		}
		if (
			!prior ||
			prior.version !== 1 ||
			prior.projectId !== projectId ||
			!prior.files ||
			typeof prior.files !== "object" ||
			Array.isArray(prior.files)
		) {
			throw new Error("Local Supabase state ownership does not match.");
		}
		const destination = join(runtime, "supabase");
		for (const directory of [destination, join(destination, ".temp")]) {
			if (
				existsSync(directory) &&
				(!lstatSync(directory).isDirectory() ||
					lstatSync(directory).isSymbolicLink())
			) {
				throw new Error("Refusing unsafe local CLI state directories.");
			}
		}
		if (existsSync(join(destination, ".temp", "project-ref"))) {
			throw new Error(
				"Refusing hosted link metadata in the local state directory.",
			);
		}
		ensureDirectory(destination);
		const hashes = Object.fromEntries(
			[...inputs].map(([name, bytes]) => [name, sha256(bytes)]),
		);
		for (const [name, expected] of Object.entries(prior.files)) {
			if (!safeInputName(name) || !/^[a-f0-9]{64}$/.test(expected)) {
				throw new Error(
					"Local Supabase input receipt contains an unsafe path.",
				);
			}
			validateParents(destination, name);
			const path = join(destination, name);
			if (
				existsSync(path) &&
				(lstatSync(path).isSymbolicLink() ||
					sha256(readFileSync(path)) !== expected)
			) {
				throw new Error(
					"Generated local inputs were edited; preserve and review them before preparing again.",
				);
			}
		}
		for (const name of inputs.keys()) {
			validateParents(destination, name);
			if (existsSync(join(destination, name)) && !(name in prior.files))
				throw new Error("Refusing to overwrite an unowned local input file.");
		}
		if (existsSync(marker) && !refreshInputs) return runtime;
		if (
			existsSync(marker) &&
			Object.keys({ ...prior.files, ...hashes }).some(
				(name) =>
					(name === "config.toml" || name.startsWith("templates/")) &&
					prior.files[name] !== hashes[name],
			)
		)
			assertConfigurationChangeSafe(projectId);
		// Establish ownership before copying so an interrupted first preparation can retry.
		if (!existsSync(marker))
			writeFileSync(
				marker,
				JSON.stringify({ version: 1, projectId, files: hashes }),
				{ flag: "wx", mode: 0o600 },
			);
		for (const [name, bytes] of inputs) {
			const path = join(destination, name);
			if (prior.files[name] === hashes[name] && existsSync(path)) continue;
			mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
			const temporary = `${path}.${randomUUID()}.building`;
			try {
				writeFileSync(temporary, bytes, {
					flag: "wx",
					mode: name.startsWith("templates/") ? 0o644 : 0o600,
				});
				renameSync(temporary, path);
			} finally {
				if (existsSync(temporary)) rmSync(temporary);
			}
		}
		for (const name of Object.keys(prior.files))
			if (!(name in hashes) && existsSync(join(destination, name)))
				rmSync(join(destination, name));
		writeFileSync(
			marker,
			JSON.stringify({ version: 1, projectId, files: hashes }),
			{ mode: 0o600 },
		);
		return runtime;
	} finally {
		rmSync(lock);
	}
};

export const localSupabaseCommandArguments = (args, options) => {
	if (!args.every((value) => typeof value === "string"))
		throw new Error("Local command arguments must be strings.");
	if (
		args.some((value) =>
			["--linked", "--db-url", "--project-ref", "--project-id"].some(
				(flag) => value === flag || value.startsWith(`${flag}=`),
			),
		)
	) {
		throw new Error("Local Supabase commands cannot use hosted link state.");
	}
	if (
		["link", "unlink", "login"].includes(args[0]) ||
		(args[0] === "db" && ["push", "pull"].includes(args[1]))
	) {
		throw new Error(
			"Hosted Supabase operations do not belong to local database commands.",
		);
	}
	const index = args.indexOf("--workdir");
	if (
		args.some((value) => value.startsWith("--workdir=")) ||
		(index >= 0 &&
			(!args[index + 1] || args.indexOf("--workdir", index + 1) >= 0))
	) {
		throw new Error("Local Supabase command has an ambiguous workdir.");
	}
	const workdir = index >= 0 ? args[index + 1] : ".";
	const clean =
		index >= 0
			? [...args.slice(0, index), ...args.slice(index + 2)]
			: [...args];
	return [
		...clean,
		"--workdir",
		prepareLocalSupabaseWorkdir({
			...options,
			workdir,
			refreshInputs: !["status", "stop"].includes(clean[0]),
		}),
	];
};
