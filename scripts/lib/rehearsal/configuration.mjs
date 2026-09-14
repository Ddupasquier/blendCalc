/**
 * Purpose: Load and strictly validate the versioned, project-owned Rehearsal
 * configuration contract. Do not run directly; this module is reusable script
 * infrastructure.
 */

import { access, readFile, stat } from "node:fs/promises";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const REHEARSAL_CONFIG_VERSION = 1;

export const REHEARSAL_DEFAULTS = Object.freeze({
	baseline: Object.freeze({ artifactDirectory: ".rehearsal" }),
	runtime: Object.freeze({
		applicationUrl: "http://localhost:5175",
		projectId: "rehearsal-local",
	}),
	safety: Object.freeze({
		allowedHosts: Object.freeze(["127.0.0.1", "::1", "localhost"]),
		blockedEnvironmentVariables: Object.freeze([
			"SUPABASE_ACCESS_TOKEN",
			"SUPABASE_DB_PASSWORD",
			"SUPABASE_PROJECT_ID",
		]),
		hostedAccess: "disabled",
		outboundNetwork: "deny",
	}),
});

const CONFIG_FILENAMES = Object.freeze([
	"rehearsal.config.mjs",
	"rehearsal.config.js",
	"rehearsal.config.ts",
	join("infrastructure", "rehearsal", "rehearsal.config.mjs"),
	join("infrastructure", "rehearsal", "rehearsal.config.ts"),
]);

const LOOPBACK_HOSTS = new Set(REHEARSAL_DEFAULTS.safety.allowedHosts);
const IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}$/u;
const SAFE_COMMAND_PATTERN = /^[^\n\r\0]+$/u;

const isPlainObject = (value) =>
	value !== null &&
	typeof value === "object" &&
	!Array.isArray(value) &&
	Object.getPrototypeOf(value) === Object.prototype;

const assertPlainObject = (value, path) => {
	if (!isPlainObject(value)) {
		throw new Error(`${path} must be an object.`);
	}
	return value;
};

const assertKnownKeys = (value, keys, path) => {
	for (const key of Object.keys(value)) {
		if (!keys.includes(key)) {
			throw new Error(
				`Unknown Rehearsal configuration property: ${path}.${key}.`,
			);
		}
	}
};

const assertNonEmptyString = (value, path) => {
	if (typeof value !== "string" || !value.trim()) {
		throw new Error(`${path} must be a non-empty string.`);
	}
	return value.trim();
};

const assertRelativePath = (value, path) => {
	const normalized = assertNonEmptyString(value, path);
	if (isAbsolute(normalized) || normalized.split(/[\\/]/u).includes("..")) {
		throw new Error(`${path} must stay inside the project root.`);
	}
	return normalized;
};

const assertCommand = (value, path) => {
	const command = assertNonEmptyString(value, path);
	if (!SAFE_COMMAND_PATTERN.test(command)) {
		throw new Error(`${path} contains an unsafe control character.`);
	}
	return command;
};

const assertPort = (value, path) => {
	if (!Number.isSafeInteger(value) || value < 1024 || value > 65_535) {
		throw new Error(`${path} must be a non-privileged TCP port.`);
	}
	return value;
};

const assertStringArray = (value, path) => {
	if (
		!Array.isArray(value) ||
		value.length === 0 ||
		value.some((entry) => typeof entry !== "string" || !entry.trim())
	) {
		throw new Error(`${path} must be a non-empty string array.`);
	}
	return [...new Set(value.map((entry) => entry.trim()))];
};

const assertLoopbackUrl = (value, path, allowedHosts) => {
	let parsed;
	try {
		parsed = new URL(assertNonEmptyString(value, path));
	} catch {
		throw new Error(`${path} must be a valid loopback URL.`);
	}
	if (
		!allowedHosts.includes(parsed.hostname) ||
		!LOOPBACK_HOSTS.has(parsed.hostname)
	) {
		throw new Error(`${path} must use an explicitly allowed loopback host.`);
	}
	if (!["http:", "https:"].includes(parsed.protocol)) {
		throw new Error(`${path} must use HTTP or HTTPS.`);
	}
	return parsed.toString().replace(/\/$/u, "");
};

const normalizeConfig = (input) => {
	const root = assertPlainObject(input, "config");
	assertKnownKeys(
		root,
		[
			"schemaVersion",
			"project",
			"supabase",
			"baseline",
			"application",
			"runtime",
			"safety",
			"verification",
		],
		"config",
	);
	if (root.schemaVersion !== REHEARSAL_CONFIG_VERSION) {
		throw new Error(
			`Unsupported Rehearsal configuration version: ${String(root.schemaVersion)}. Expected ${REHEARSAL_CONFIG_VERSION}.`,
		);
	}

	const project = assertPlainObject(root.project, "config.project");
	assertKnownKeys(project, ["name"], "config.project");
	const projectName = assertNonEmptyString(project.name, "config.project.name");
	if (!IDENTIFIER_PATTERN.test(projectName)) {
		throw new Error(
			"config.project.name must contain only lowercase letters, digits, and hyphens.",
		);
	}

	const supabase = assertPlainObject(root.supabase, "config.supabase");
	assertKnownKeys(
		supabase,
		[
			"workdir",
			"migrationDirectory",
			"rehearsalConfig",
			"runtimeWorkdir",
			"serviceEnvironmentFile",
			"serviceEnvironmentVariables",
		],
		"config.supabase",
	);
	const baseline = assertPlainObject(root.baseline, "config.baseline");
	assertKnownKeys(
		baseline,
		["artifactDirectory", "sanitizationPolicy"],
		"config.baseline",
	);
	const application = assertPlainObject(root.application, "config.application");
	assertKnownKeys(
		application,
		["startCommand", "proofCommand", "environmentFile", "runtimeAdapter"],
		"config.application",
	);
	const runtime = assertPlainObject(root.runtime ?? {}, "config.runtime");
	assertKnownKeys(
		runtime,
		["applicationUrl", "projectId", "apiPort", "databasePort", "studioPort"],
		"config.runtime",
	);
	const safety = assertPlainObject(root.safety ?? {}, "config.safety");
	assertKnownKeys(
		safety,
		[
			"allowedHosts",
			"blockedEnvironmentVariables",
			"authenticationProviders",
			"hostedAccess",
			"outboundNetwork",
		],
		"config.safety",
	);
	const verification = assertPlainObject(
		root.verification ?? {},
		"config.verification",
	);
	assertKnownKeys(verification, ["commands"], "config.verification");

	const allowedHosts = assertStringArray(
		safety.allowedHosts ?? REHEARSAL_DEFAULTS.safety.allowedHosts,
		"config.safety.allowedHosts",
	);
	if (allowedHosts.some((host) => !LOOPBACK_HOSTS.has(host))) {
		throw new Error(
			"config.safety.allowedHosts may contain loopback hosts only in configuration version 1.",
		);
	}
	if ((safety.hostedAccess ?? "disabled") !== "disabled") {
		throw new Error(
			"config.safety.hostedAccess must remain disabled in configuration version 1.",
		);
	}
	if ((safety.outboundNetwork ?? "deny") !== "deny") {
		throw new Error(
			"config.safety.outboundNetwork must remain deny in configuration version 1.",
		);
	}

	const ports = {
		api: assertPort(runtime.apiPort, "config.runtime.apiPort"),
		database: assertPort(runtime.databasePort, "config.runtime.databasePort"),
		studio: assertPort(runtime.studioPort, "config.runtime.studioPort"),
	};
	if (new Set(Object.values(ports)).size !== Object.values(ports).length) {
		throw new Error("Rehearsal runtime ports must be unique.");
	}

	const commands = verification.commands ?? [];
	if (!Array.isArray(commands)) {
		throw new Error("config.verification.commands must be an array.");
	}
	const serviceEnvironmentVariables =
		supabase.serviceEnvironmentVariables ?? [];
	if (!Array.isArray(serviceEnvironmentVariables)) {
		throw new Error(
			"config.supabase.serviceEnvironmentVariables must be an array.",
		);
	}
	const normalizedServiceEnvironmentVariables = serviceEnvironmentVariables.map(
		(value, index) =>
			assertNonEmptyString(
				value,
				`config.supabase.serviceEnvironmentVariables[${index}]`,
			),
	);
	if (
		new Set(normalizedServiceEnvironmentVariables).size !==
		normalizedServiceEnvironmentVariables.length
	) {
		throw new Error(
			"config.supabase.serviceEnvironmentVariables must not contain duplicates.",
		);
	}
	if (
		Boolean(supabase.serviceEnvironmentFile) !==
		Boolean(normalizedServiceEnvironmentVariables.length)
	) {
		throw new Error(
			"config.supabase.serviceEnvironmentFile and serviceEnvironmentVariables must be configured together.",
		);
	}

	return Object.freeze({
		schemaVersion: REHEARSAL_CONFIG_VERSION,
		project: Object.freeze({ name: projectName }),
		supabase: Object.freeze({
			workdir: assertRelativePath(supabase.workdir, "config.supabase.workdir"),
			migrationDirectory: assertRelativePath(
				supabase.migrationDirectory,
				"config.supabase.migrationDirectory",
			),
			rehearsalConfig: assertRelativePath(
				supabase.rehearsalConfig,
				"config.supabase.rehearsalConfig",
			),
			runtimeWorkdir: assertRelativePath(
				supabase.runtimeWorkdir,
				"config.supabase.runtimeWorkdir",
			),
			serviceEnvironmentFile: supabase.serviceEnvironmentFile
				? assertRelativePath(
						supabase.serviceEnvironmentFile,
						"config.supabase.serviceEnvironmentFile",
					)
				: null,
			serviceEnvironmentVariables: Object.freeze(
				normalizedServiceEnvironmentVariables,
			),
		}),
		baseline: Object.freeze({
			artifactDirectory: assertRelativePath(
				baseline.artifactDirectory ??
					REHEARSAL_DEFAULTS.baseline.artifactDirectory,
				"config.baseline.artifactDirectory",
			),
			sanitizationPolicy: assertRelativePath(
				baseline.sanitizationPolicy,
				"config.baseline.sanitizationPolicy",
			),
		}),
		application: Object.freeze({
			startCommand: assertCommand(
				application.startCommand,
				"config.application.startCommand",
			),
			proofCommand: assertCommand(
				application.proofCommand,
				"config.application.proofCommand",
			),
			environmentFile: assertRelativePath(
				application.environmentFile ?? ".rehearsal/runtime.env",
				"config.application.environmentFile",
			),
			runtimeAdapter:
				application.runtimeAdapter === undefined
					? null
					: assertRelativePath(
							application.runtimeAdapter,
							"config.application.runtimeAdapter",
						),
		}),
		runtime: Object.freeze({
			applicationUrl: assertLoopbackUrl(
				runtime.applicationUrl ?? REHEARSAL_DEFAULTS.runtime.applicationUrl,
				"config.runtime.applicationUrl",
				allowedHosts,
			),
			projectId: assertNonEmptyString(
				runtime.projectId ?? REHEARSAL_DEFAULTS.runtime.projectId,
				"config.runtime.projectId",
			),
			ports: Object.freeze(ports),
		}),
		safety: Object.freeze({
			allowedHosts: Object.freeze(allowedHosts),
			blockedEnvironmentVariables: Object.freeze(
				assertStringArray(
					safety.blockedEnvironmentVariables ??
						REHEARSAL_DEFAULTS.safety.blockedEnvironmentVariables,
					"config.safety.blockedEnvironmentVariables",
				),
			),
			authenticationProviders: Object.freeze(
				safety.authenticationProviders
					? assertStringArray(
							safety.authenticationProviders,
							"config.safety.authenticationProviders",
						)
					: [],
			),
			hostedAccess: "disabled",
			outboundNetwork: "deny",
		}),
		verification: Object.freeze({
			commands: Object.freeze(
				commands.map((command, index) =>
					assertCommand(command, `config.verification.commands[${index}]`),
				),
			),
		}),
	});
};

export const defineRehearsalConfig = (config) => config;

export const findRehearsalConfigPath = async ({ projectRoot, configPath }) => {
	const root = resolve(projectRoot);
	if (configPath) {
		const explicit = resolve(root, configPath);
		if (relative(root, explicit).startsWith("..")) {
			throw new Error(
				"The Rehearsal configuration must stay inside the project root.",
			);
		}
		await access(explicit);
		return explicit;
	}
	for (const filename of CONFIG_FILENAMES) {
		const candidate = join(root, filename);
		try {
			await access(candidate);
			return candidate;
		} catch (error) {
			if (error?.code !== "ENOENT") throw error;
		}
	}
	throw new Error(
		`No Rehearsal configuration was found. Checked: ${CONFIG_FILENAMES.join(", ")}.`,
	);
};

export const loadRehearsalConfig = async ({
	projectRoot = process.cwd(),
	configPath,
} = {}) => {
	const root = resolve(projectRoot);
	const path = await findRehearsalConfigPath({ projectRoot: root, configPath });
	const module = await import(
		`${pathToFileURL(path).href}?loaded=${Date.now()}`
	);
	const config = normalizeConfig(module.default);
	const resolveOwnedPath = (value) => {
		const resolved = resolve(root, value);
		if (relative(root, resolved).startsWith("..")) {
			throw new Error(`A Rehearsal path escaped the project root: ${value}.`);
		}
		return resolved;
	};
	const paths = Object.freeze({
		artifactDirectory: resolveOwnedPath(config.baseline.artifactDirectory),
		applicationEnvironment: resolveOwnedPath(
			config.application.environmentFile,
		),
		migrationDirectory: resolveOwnedPath(config.supabase.migrationDirectory),
		rehearsalConfig: resolveOwnedPath(config.supabase.rehearsalConfig),
		runtimeWorkdir: resolveOwnedPath(config.supabase.runtimeWorkdir),
		serviceEnvironment: config.supabase.serviceEnvironmentFile
			? resolveOwnedPath(config.supabase.serviceEnvironmentFile)
			: null,
		sanitizationPolicy: resolveOwnedPath(config.baseline.sanitizationPolicy),
		supabaseWorkdir: resolveOwnedPath(config.supabase.workdir),
		runtimeAdapter: config.application.runtimeAdapter
			? resolveOwnedPath(config.application.runtimeAdapter)
			: null,
	});
	const requiredRuntimeWorkdir = join(paths.artifactDirectory, "runtime");
	if (paths.runtimeWorkdir !== requiredRuntimeWorkdir) {
		throw new Error(
			"config.supabase.runtimeWorkdir must resolve to the runtime directory inside config.baseline.artifactDirectory.",
		);
	}
	const environmentRelativePath = relative(
		paths.artifactDirectory,
		paths.applicationEnvironment,
	);
	if (
		!environmentRelativePath ||
		environmentRelativePath.startsWith("..") ||
		isAbsolute(environmentRelativePath)
	) {
		throw new Error(
			"config.application.environmentFile must resolve to a file inside config.baseline.artifactDirectory.",
		);
	}
	if (!IDENTIFIER_PATTERN.test(config.runtime.projectId)) {
		throw new Error(
			"config.runtime.projectId must contain only lowercase letters, digits, and hyphens.",
		);
	}
	return Object.freeze({
		config,
		configPath: path,
		projectRoot: root,
		paths,
	});
};

export const inspectDetectedProject = async ({
	projectRoot = process.cwd(),
} = {}) => {
	const root = resolve(projectRoot);
	const packageJsonPath = join(root, "package.json");
	const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
	const hasPath = async (path) =>
		stat(join(root, path))
			.then(() => true)
			.catch((error) => {
				if (error?.code === "ENOENT") return false;
				throw error;
			});
	const packageManager = (await hasPath("pnpm-lock.yaml"))
		? "pnpm"
		: (await hasPath("yarn.lock"))
			? "yarn"
			: "npm";
	const scripts = packageJson.scripts ?? {};
	return {
		projectName:
			String(packageJson.name ?? basename(root))
				.toLowerCase()
				.replace(/[^a-z0-9-]+/gu, "-")
				.replace(/^-|-$/gu, "") || "rehearsal-project",
		packageManager,
		hasSupabaseConfig: await hasPath("supabase/config.toml"),
		hasMigrations: await hasPath("supabase/migrations"),
		applicationCommand:
			["dev:rehearsal", "dev", "start"]
				.find((name) => typeof scripts[name] === "string")
				?.replace(/^/u, `${packageManager} run `) ??
			`${packageManager} run dev`,
		verificationCommand:
			["verify:feature", "test", "check"]
				.find((name) => typeof scripts[name] === "string")
				?.replace(/^/u, `${packageManager} run `) ?? `${packageManager} test`,
	};
};

export const renderDetectedConfig = (
	detected,
) => `import { defineRehearsalConfig } from "@rehearsal/db";

export default defineRehearsalConfig({
	schemaVersion: 1,
	project: { name: ${JSON.stringify(detected.projectName)} },
	supabase: {
		workdir: ".",
		migrationDirectory: "supabase/migrations",
		rehearsalConfig: "infrastructure/rehearsal/supabase/config.toml",
		runtimeWorkdir: ".rehearsal/runtime",
	},
	baseline: {
		artifactDirectory: ".rehearsal",
		sanitizationPolicy: "infrastructure/rehearsal/sanitization-policy.json",
	},
	application: {
		startCommand: ${JSON.stringify(detected.applicationCommand)},
		proofCommand: ${JSON.stringify(detected.verificationCommand)},
		environmentFile: ".rehearsal/runtime.env",
	},
	runtime: {
		applicationUrl: "http://localhost:5175",
		projectId: "${detected.projectName}-rehearsal",
		apiPort: 58321,
		databasePort: 58322,
		studioPort: 58323,
	},
	safety: {
		allowedHosts: ["127.0.0.1", "::1", "localhost"],
		blockedEnvironmentVariables: [
			"SUPABASE_ACCESS_TOKEN",
			"SUPABASE_DB_PASSWORD",
			"SUPABASE_PROJECT_ID",
		],
		hostedAccess: "disabled",
		outboundNetwork: "deny",
	},
	verification: { commands: [${JSON.stringify(detected.verificationCommand)}] },
});
`;
