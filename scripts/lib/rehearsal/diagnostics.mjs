/**
 * Purpose: Provide stable Rehearsal result, failure, redaction, and rendering
 * contracts for humans and automation. Do not run directly; this module is reusable
 * script infrastructure.
 */

import { createHash } from "node:crypto";

export const REHEARSAL_RESULT_VERSION = 1;
export const REHEARSAL_VERSION = "0.1.0-beta.0";

export const REHEARSAL_EXIT_CODES = Object.freeze({
	success: 0,
	configuration_invalid: 2,
	unsafe_environment: 3,
	baseline_invalid: 4,
	baseline_checksum_mismatch: 5,
	migration_candidate_failure: 6,
	migration_verification_failure: 7,
	application_proof_failure: 8,
	runtime_dependency_failure: 9,
	internal_failure: 10,
});

const SECRET_KEY_PATTERN =
	/(?:authorization|cookie|credential|database[_-]?url|jwt|key|password|secret|service[_-]?role|token)/iu;
const JWT_PATTERN =
	/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/gu;
const CONNECTION_STRING_PATTERN =
	/\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s"']+/giu;
const BEARER_PATTERN = /\bBearer\s+[^\s"']+/giu;
const SUPABASE_KEY_PATTERN = /\bsb_(?:publishable|secret)_[A-Za-z0-9_-]+\b/gu;

const redactString = (value) =>
	value
		.replace(CONNECTION_STRING_PATTERN, "[REDACTED_CONNECTION_STRING]")
		.replace(JWT_PATTERN, "[REDACTED_JWT]")
		.replace(BEARER_PATTERN, "Bearer [REDACTED]")
		.replace(SUPABASE_KEY_PATTERN, "[REDACTED_KEY]");

export const redactDiagnosticValue = (value, key = "") => {
	if (SECRET_KEY_PATTERN.test(key)) return "[REDACTED]";
	if (typeof value === "string") return redactString(value);
	if (Array.isArray(value)) {
		return value.map((entry) => redactDiagnosticValue(entry));
	}
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value).map(([entryKey, entryValue]) => [
				entryKey,
				redactDiagnosticValue(entryValue, entryKey),
			]),
		);
	}
	return value;
};

const diagnosticIdFor = ({ category, code, message }) =>
	createHash("sha256")
		.update(`${category}\0${code}\0${message}`)
		.digest("hex")
		.slice(0, 12);

export class RehearsalError extends Error {
	constructor({
		category,
		code,
		message,
		expected,
		actual,
		context,
		refused,
		suggestions = [],
		cause,
	}) {
		super(message, { cause });
		this.name = "RehearsalError";
		if (!Object.hasOwn(REHEARSAL_EXIT_CODES, category)) {
			throw new Error(`Unknown Rehearsal error category: ${category}.`);
		}
		this.category = category;
		this.code = code;
		this.expected = expected;
		this.actual = actual;
		this.context = context;
		this.refused = refused;
		this.suggestions = suggestions;
		this.diagnosticId = diagnosticIdFor({ category, code, message });
		this.exitCode = REHEARSAL_EXIT_CODES[category];
	}
}

const inferCategory = (error) => {
	const message = String(error?.message ?? error);
	if (/checksum/iu.test(message)) return "baseline_checksum_mismatch";
	if (/candidate|migration history diverges/iu.test(message)) {
		return "migration_candidate_failure";
	}
	if (/baseline|artifact|generation/iu.test(message)) return "baseline_invalid";
	if (/migration|ledger|replay/iu.test(message)) {
		return "migration_verification_failure";
	}
	if (/config|unknown rehearsal|unsupported rehearsal/iu.test(message)) {
		return "configuration_invalid";
	}
	if (/loopback|hosted|unsafe|credential|outbound/iu.test(message)) {
		return "unsafe_environment";
	}
	if (/docker|supabase|runtime|command|enoent/iu.test(message)) {
		return "runtime_dependency_failure";
	}
	return "internal_failure";
};

export const normalizeRehearsalError = (error, overrides = {}) => {
	if (error instanceof RehearsalError) return error;
	const message = String(error?.message ?? error);
	const category = overrides.category ?? inferCategory(error);
	return new RehearsalError({
		category,
		code: overrides.code ?? category.toUpperCase(),
		message,
		expected: overrides.expected,
		actual: overrides.actual,
		context: overrides.context,
		refused:
			overrides.refused ??
			"Rehearsal stopped before performing the requested operation.",
		suggestions: overrides.suggestions ?? [],
		cause: error,
	});
};

export const createRehearsalResult = ({
	command,
	status,
	data,
	warnings = [],
	startedAt = new Date(),
	durationMs = 0,
}) =>
	redactDiagnosticValue({
		schemaVersion: REHEARSAL_RESULT_VERSION,
		rehearsalVersion: REHEARSAL_VERSION,
		command,
		status,
		startedAt: startedAt.toISOString(),
		durationMs,
		warnings,
		data,
	});

export const serializeRehearsalError = (error, { debug = false } = {}) => {
	const failure = normalizeRehearsalError(error);
	return redactDiagnosticValue({
		schemaVersion: REHEARSAL_RESULT_VERSION,
		rehearsalVersion: REHEARSAL_VERSION,
		status: "error",
		error: {
			category: failure.category,
			code: failure.code,
			message: failure.message,
			expected: failure.expected,
			actual: failure.actual,
			context: failure.context,
			refused: failure.refused,
			suggestions: failure.suggestions,
			diagnosticId: failure.diagnosticId,
			...(debug && failure.cause
				? { cause: String(failure.cause?.message ?? failure.cause) }
				: {}),
		},
	});
};

const formatValue = (value) =>
	typeof value === "string" ? value : JSON.stringify(value);

export const renderHumanError = (error, { debug = false } = {}) => {
	const { error: failure } = serializeRehearsalError(error, { debug });
	return [
		`Rehearsal stopped: ${failure.message}`,
		failure.expected ? `Expected: ${formatValue(failure.expected)}` : null,
		failure.actual ? `Actual: ${formatValue(failure.actual)}` : null,
		failure.context ? `Context: ${formatValue(failure.context)}` : null,
		failure.refused ? `Refused: ${failure.refused}` : null,
		...(failure.suggestions ?? []).map((value) => `Try: ${value}`),
		`Diagnostic: ${failure.diagnosticId} (${failure.category})`,
		debug && failure.cause ? `Cause: ${failure.cause}` : null,
	]
		.filter(Boolean)
		.join("\n");
};
