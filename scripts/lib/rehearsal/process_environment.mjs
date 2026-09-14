/**
 * Purpose: Build minimal child-process environments and validate loopback URLs for
 * the project-neutral Rehearsal runtime. Do not run directly; this module is reusable
 * script infrastructure.
 */

const SAFE_SYSTEM_ENVIRONMENT_KEYS = Object.freeze([
	"CI",
	"COLORTERM",
	"FORCE_COLOR",
	"HOME",
	"LANG",
	"LANGUAGE",
	"LC_ALL",
	"LOGNAME",
	"NO_COLOR",
	"PATH",
	"SHELL",
	"TERM",
	"TMP",
	"TMPDIR",
	"TEMP",
	"USER",
]);

const LOOPBACK_HOSTNAMES = new Set(["127.0.0.1", "::1", "localhost"]);

export const isLoopbackUrl = (value) => {
	try {
		return LOOPBACK_HOSTNAMES.has(new URL(value).hostname);
	} catch {
		return false;
	}
};

export const assertLoopbackUrl = (label, value) => {
	if (!value || !isLoopbackUrl(value)) {
		throw new Error(
			`${label} must use a loopback URL; received a non-local target.`,
		);
	}
};

export const pickEnvironmentVariables = (source, keys) =>
	Object.fromEntries(
		keys.flatMap((key) => {
			const value = source[key];
			return value === undefined ? [] : [[key, value]];
		}),
	);

export const createCleanProcessEnvironment = ({
	inheritedEnvironment = process.env,
	overrides = {},
	passthroughKeys = [],
} = {}) => ({
	...pickEnvironmentVariables(inheritedEnvironment, [
		...SAFE_SYSTEM_ENVIRONMENT_KEYS,
		...passthroughKeys,
	]),
	...Object.fromEntries(
		Object.entries(overrides).filter(([, value]) => value !== undefined),
	),
});
