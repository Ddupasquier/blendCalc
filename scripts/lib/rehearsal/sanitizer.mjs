/**
 * Purpose: Sanitize one Rehearsal row in memory according to an already reviewed
 * explicit manifest. Do not run directly; this module is reusable script
 * infrastructure.
 */

import { createHmac, randomBytes } from "node:crypto";
import { SANITIZATION_ACTIONS } from "./sanitization_policy.mjs";

const uuidPattern =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const emailValuePattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const urlValuePattern = /^(?:https?|s3):\/\//iu;
const ipValuePattern = /^(?:\d{1,3}\.){3}\d{1,3}$/u;
const jwtLikePattern =
	/^[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}$/u;
const secretKeyPattern =
	/(?:secret|password|token|authorization|api[_-]?key|mfa|recovery)/iu;
const identityKeyPattern =
	/(?:^|_)(?:user|owner|actor|submitted_by|reviewed_by|approved_by|created_by|reported_by|resolved_by)(?:_id)?$/iu;
const structuralJsonKeyPattern =
	/(?:status|type|kind|mode|unit|basis|role|action|outcome|severity|confidence|version|code|method)$/iu;
const jsonGtinKeyPattern = /^(?:barcode|gtin|gtinUpc|upc)$/iu;
const hashColumnPattern = /(?:hash|checksum|sha256|fingerprint)/iu;
const timestampTypePattern = /timestamp|date/iu;
const gtinLengths = new Set([8, 12, 13, 14]);

const digestHex = (key, namespace, value) =>
	createHmac("sha256", key)
		.update(namespace)
		.update("\0")
		.update(String(value))
		.digest("hex");

const fitSyntheticText = (source, prefix, digest, maximumLength) => {
	const sourceLength = String(source).length;
	const targetLength = Math.max(
		1,
		Math.min(maximumLength ?? sourceLength, sourceLength || prefix.length + 12),
	);
	const seed = `${digest}-${prefix}`;
	return seed
		.repeat(Math.ceil(targetLength / seed.length))
		.slice(0, targetLength);
};

const fitHumanReadableSyntheticText = (
	source,
	label,
	digest,
	maximumLength,
) => {
	const candidate = `${label} ${digest.slice(0, 6).toUpperCase()}`;
	const limit =
		maximumLength ?? Math.max(String(source).length, candidate.length);
	if (limit >= candidate.length) return candidate;
	if (limit >= 8) return `R-${digest.slice(0, limit - 2).toUpperCase()}`;
	return digest.slice(0, Math.max(1, limit)).toUpperCase();
};

const toSyntheticUuid = (digest) => {
	const bytes = Buffer.from(digest.slice(0, 32), "hex");
	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	const hex = bytes.toString("hex");
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const gtinCheckDigit = (body) => {
	let sum = 0;
	for (
		let index = body.length - 1, position = 0;
		index >= 0;
		index -= 1, position += 1
	) {
		sum += Number(body[index]) * (position % 2 === 0 ? 3 : 1);
	}
	return String((10 - (sum % 10)) % 10);
};

const toSyntheticDigits = (value, digest, { gtin = false } = {}) => {
	const length = String(value).length;
	const digitStream = [...digest]
		.map((character) => String(Number.parseInt(character, 16) % 10))
		.join("")
		.repeat(Math.ceil(length / digest.length));
	if (gtin && gtinLengths.has(length)) {
		const body = digitStream.slice(0, length - 1).replace(/^0+$/u, "1");
		return `${body}${gtinCheckDigit(body)}`;
	}
	return digitStream.slice(0, length).replace(/^0+$/u, "1".padEnd(length, "0"));
};

export const createSanitizationContext = ({
	key = randomBytes(32),
	ownerSourceUserId = null,
	ownerEmailSha256 = null,
} = {}) => {
	if (!Buffer.isBuffer(key) || key.length < 32) {
		throw new Error(
			"Rehearsal sanitization requires an in-memory key of at least 32 bytes.",
		);
	}
	const secret = Buffer.from(key);
	if (ownerSourceUserId !== null && !uuidPattern.test(ownerSourceUserId)) {
		throw new Error("The Rehearsal owner source identity must be a UUID.");
	}
	if (ownerEmailSha256 !== null && !/^[a-f0-9]{64}$/u.test(ownerEmailSha256)) {
		throw new Error("The Rehearsal owner email receipt must be a SHA-256.");
	}
	if ((ownerSourceUserId === null) !== (ownerEmailSha256 === null)) {
		throw new Error(
			"The Rehearsal owner identity and email receipt must be supplied together.",
		);
	}
	const mappings = new Map();
	const timestampShiftDays =
		(Number.parseInt(
			digestHex(secret, "timestamp-shift", "refresh").slice(0, 8),
			16,
		) %
			7301) -
		3650;
	let disposed = false;
	let transformedValues = 0;

	const requireActive = () => {
		if (disposed)
			throw new Error("The Rehearsal sanitization context has been disposed.");
	};
	const mapValue = (namespace, value, factory) => {
		requireActive();
		const mappingKey = `${namespace}\0${typeof value}\0${String(value)}`;
		if (!mappings.has(mappingKey)) {
			mappings.set(mappingKey, factory(digestHex(secret, namespace, value)));
		}
		transformedValues += 1;
		return mappings.get(mappingKey);
	};
	const ownerPersonaUserId = ownerSourceUserId
		? mapValue("identity:auth.users.id", ownerSourceUserId, toSyntheticUuid)
		: null;
	const preserveOwnerValue = (value) => {
		requireActive();
		if (
			value === null ||
			typeof value === "number" ||
			typeof value === "boolean"
		) {
			return value;
		}
		if (Array.isArray(value)) return value.map(preserveOwnerValue);
		if (typeof value === "object") {
			return Object.fromEntries(
				Object.entries(value).map(([name, entry]) => [
					name,
					preserveOwnerValue(entry),
				]),
			);
		}
		return ownerSourceUserId && ownerPersonaUserId
			? value.replaceAll(ownerSourceUserId, ownerPersonaUserId)
			: value;
	};

	return Object.freeze({
		ownerSourceUserId,
		ownerPersonaUserId,
		ownerEmailSha256,
		isOwnerIdentity(value) {
			requireActive();
			return ownerSourceUserId !== null && value === ownerSourceUserId;
		},
		preserveOwnerValue,
		digest(namespace, value) {
			requireActive();
			transformedValues += 1;
			return digestHex(secret, namespace, value);
		},
		map: mapValue,
		shiftTimestamp(value, { dateOnly = false } = {}) {
			requireActive();
			const parsed = new Date(value);
			if (Number.isNaN(parsed.valueOf())) return null;
			parsed.setUTCDate(parsed.getUTCDate() + timestampShiftDays);
			parsed.setUTCMinutes(Math.floor(parsed.getUTCMinutes() / 15) * 15, 0, 0);
			return dateOnly
				? parsed.toISOString().slice(0, 10)
				: parsed.toISOString();
		},
		stats() {
			requireActive();
			return { transformedValues, activeMappings: mappings.size };
		},
		dispose() {
			if (disposed) return;
			secret.fill(0);
			mappings.clear();
			disposed = true;
		},
	});
};

const pseudonymize = (value, column, context, namespace) => {
	if (value === null) return null;
	if (Array.isArray(value)) {
		return value.map((entry) =>
			pseudonymize(entry, column, context, namespace),
		);
	}
	return context.map(namespace, value, (digest) => {
		if (typeof value === "string" && uuidPattern.test(value))
			return toSyntheticUuid(digest);
		if (typeof value === "number") {
			const precision = Math.min(column.numericPrecision ?? 12, 12);
			return (
				Number(
					BigInt(`0x${digest.slice(0, 12)}`) % (10n ** BigInt(precision) - 1n),
				) + 1
			);
		}
		if (typeof value === "string" && /^\d+$/u.test(value)) {
			return toSyntheticDigits(value, digest, {
				gtin: new Set(["barcode", "gtin", "gtinupc", "upc"]).has(
					column.name.toLowerCase(),
				),
			});
		}
		return fitSyntheticText(
			value,
			"synthetic",
			digest,
			column.characterMaximumLength,
		);
	});
};

const replaceWithSynthetic = (value, column, context, namespace) => {
	if (value === null) return null;
	if (Array.isArray(value)) {
		return value.map((entry, index) =>
			replaceWithSynthetic(entry, column, context, `${namespace}[${index}]`),
		);
	}
	const type = `${column.dataType} ${column.udtName}`;
	if (timestampTypePattern.test(type)) {
		const shifted = context.shiftTimestamp(value, {
			dateOnly: column.dataType === "date",
		});
		if (!shifted) throw new Error(`Invalid timestamp at ${namespace}.`);
		return shifted;
	}
	if (column.udtName === "uuid" || uuidPattern.test(String(value))) {
		return context.map(namespace, value, toSyntheticUuid);
	}
	if (typeof value === "number") {
		return pseudonymize(value, column, context, namespace);
	}
	if (typeof value === "boolean") {
		return (
			Number.parseInt(context.digest(namespace, value).at(0), 16) % 2 === 0
		);
	}
	const digest = context.digest(namespace, value);
	if (/(?:^|_)email(?:_|$)|recipient/iu.test(column.name)) {
		const domain = "@blendcalc.local";
		const maximumLength = column.characterMaximumLength ?? 254;
		const localPart = `rehearsal-${digest.slice(0, 16)}`.slice(
			0,
			Math.max(1, maximumLength - domain.length),
		);
		return `${localPart}${domain}`;
	}
	if (column.syntheticFormat === "url" || /url|uri/iu.test(column.name)) {
		const targetLength = Math.max(
			20,
			Math.min(
				column.characterMaximumLength ?? String(value).length,
				String(value).length,
			),
		);
		return `https://127.0.0.1/rehearsal/${digest}`.slice(0, targetLength);
	}
	if (/path|filename|file_name|storage/iu.test(column.name)) {
		const targetLength = Math.max(
			1,
			Math.min(
				column.characterMaximumLength ?? String(value).length,
				String(value).length,
			),
		);
		return `rehearsal/${digest}`.slice(0, targetLength);
	}
	return fitSyntheticText(
		value,
		"synthetic",
		digest,
		column.characterMaximumLength,
	);
};

const sanitizeJson = (
	value,
	context,
	namespace,
	keyName = "value",
	jsonPolicy = null,
) => {
	if (value === null || typeof value === "number" || typeof value === "boolean")
		return value;
	if (Array.isArray(value)) {
		return value.map((entry, index) =>
			sanitizeJson(
				entry,
				context,
				`${namespace}[${index}]`,
				keyName,
				jsonPolicy,
			),
		);
	}
	if (typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value).map(([key, entry]) => [
				key,
				sanitizeJson(entry, context, `${namespace}.${key}`, key, jsonPolicy),
			]),
		);
	}
	const digest = context.digest(namespace, value);
	if (jwtLikePattern.test(value) || secretKeyPattern.test(keyName)) {
		return fitSyntheticText(value, "redacted", digest);
	}
	if (jsonPolicy?.keepExactKeys?.includes(keyName)) return value;
	if (jsonPolicy?.timestampKeys?.includes(keyName)) {
		const shifted = context.shiftTimestamp(value, {
			dateOnly: /^\d{4}-\d{2}-\d{2}$/u.test(value),
		});
		if (!shifted) throw new Error(`Invalid timestamp at ${namespace}.`);
		return shifted;
	}
	const humanReadableLabel = jsonPolicy?.humanReadableKeys?.[keyName];
	if (humanReadableLabel) {
		return fitHumanReadableSyntheticText(value, humanReadableLabel, digest);
	}
	if (jsonGtinKeyPattern.test(keyName) && /^\d+$/u.test(value)) {
		return pseudonymize(
			value,
			{ name: keyName },
			context,
			"identity:product.gtin",
		);
	}
	if (structuralJsonKeyPattern.test(keyName)) return value;
	if (identityKeyPattern.test(keyName) || uuidPattern.test(value)) {
		return pseudonymize(
			value,
			{ name: keyName },
			context,
			"identity:auth.users.id",
		);
	}
	if (emailValuePattern.test(value))
		return `rehearsal-${digest.slice(0, 16)}@blendcalc.local`;
	if (urlValuePattern.test(value))
		return `http://127.0.0.1/rehearsal/${digest.slice(0, 20)}`;
	if (ipValuePattern.test(value))
		return `192.0.2.${(Number.parseInt(digest.slice(0, 2), 16) % 254) + 1}`;
	return fitSyntheticText(value, "synthetic", digest);
};

const derive = (value, column, context, namespace, sanitizedRow) => {
	if (value === null) return null;
	const type = `${column.dataType} ${column.udtName}`;
	if (/json/iu.test(type) || typeof value === "object") {
		return sanitizeJson(value, context, namespace, "value", column.jsonPolicy);
	}
	if (timestampTypePattern.test(type)) {
		const shifted = context.shiftTimestamp(value, {
			dateOnly: column.dataType === "date",
		});
		if (!shifted) throw new Error(`Invalid timestamp at ${namespace}.`);
		return shifted;
	}
	const digest = context.digest(
		namespace,
		hashColumnPattern.test(column.name)
			? JSON.stringify(sanitizedRow)
			: String(value),
	);
	if (typeof value === "number") return Number.parseInt(digest.slice(0, 8), 16);
	if (hashColumnPattern.test(column.name)) {
		return digest.slice(
			0,
			Math.max(1, Math.min(String(value).length, digest.length)),
		);
	}
	return fitSyntheticText(
		value,
		"derived",
		digest,
		column.characterMaximumLength,
	);
};

export const sanitizeRow = ({
	tablePolicy,
	row,
	context,
	forbiddenCanaries = [],
}) => {
	if (
		!tablePolicy ||
		!context ||
		!row ||
		typeof row !== "object" ||
		Array.isArray(row)
	) {
		throw new Error(
			"Rehearsal row sanitation requires a table policy, row object, and active context.",
		);
	}
	if (tablePolicy.sourceRows === "EXCLUDE") return null;
	const policyNames = new Set(tablePolicy.columns.map((column) => column.name));
	const unknownColumns = Object.keys(row).filter(
		(name) => !policyNames.has(name),
	);
	const missingColumns = tablePolicy.columns
		.filter((column) => column.action !== SANITIZATION_ACTIONS.EXCLUDE)
		.map((column) => column.name)
		.filter((name) => !Object.hasOwn(row, name));
	if (unknownColumns.length || missingColumns.length) {
		throw new Error(
			`Rehearsal row shape mismatch for ${tablePolicy.name}. Unknown: ${unknownColumns.join(", ") || "none"}. Missing: ${missingColumns.join(", ") || "none"}.`,
		);
	}

	const sanitized = {};
	const isOwnerRow = (tablePolicy.ownerIdentityColumns ?? []).some(
		(columnName) => context.isOwnerIdentity?.(row[columnName]),
	);
	for (const column of tablePolicy.columns) {
		if (column.action === SANITIZATION_ACTIONS.EXCLUDE) continue;
		const namespace = `${tablePolicy.name}.${column.name}`;
		const value = row[column.name];
		const mustRemainPseudonymous =
			column.mappingDomain === "identity:auth.users.id" ||
			/(?:^|_)email(?:_|$)|recipient/iu.test(column.name);
		sanitized[column.name] =
			isOwnerRow && !mustRemainPseudonymous
				? context.preserveOwnerValue(value)
				: column.action === SANITIZATION_ACTIONS.KEEP_EXACTLY
					? value
					: column.action === SANITIZATION_ACTIONS.PSEUDONYMIZE
						? pseudonymize(
								value,
								column,
								context,
								column.mappingDomain ?? namespace,
							)
						: column.action === SANITIZATION_ACTIONS.REPLACE_WITH_SYNTHETIC
							? replaceWithSynthetic(value, column, context, namespace)
							: derive(value, column, context, namespace, sanitized);
	}
	assertNoForbiddenCanaries(sanitized, forbiddenCanaries, tablePolicy.name);
	return sanitized;
};

export async function* sanitizeRecordStream({
	records,
	manifest,
	context,
	forbiddenCanaries = [],
}) {
	if (!records?.[Symbol.asyncIterator] && !records?.[Symbol.iterator]) {
		throw new Error("Rehearsal sanitation requires an iterable source stream.");
	}
	if (!Array.isArray(manifest?.tables) || manifest.tables.length === 0) {
		throw new Error("Rehearsal sanitation requires a reviewed manifest.");
	}
	const policies = new Map(manifest.tables.map((table) => [table.name, table]));
	for await (const record of records) {
		if (!record || typeof record.table !== "string") {
			throw new Error("A Rehearsal source record has an invalid shape.");
		}
		const tablePolicy = policies.get(record.table);
		if (!tablePolicy) {
			throw new Error(
				`The source stream exposed unclassified table ${record.table}.`,
			);
		}
		if (tablePolicy.sourceRows === "EXCLUDE") {
			throw new Error(
				`The source stream exposed excluded table ${record.table} before sanitation.`,
			);
		}
		const row = sanitizeRow({
			tablePolicy,
			row: record.row,
			context,
			forbiddenCanaries,
		});
		yield { table: record.table, row };
	}
}

export const assertNoForbiddenCanaries = (
	value,
	canaries,
	location = "sanitized output",
) => {
	const serialized = JSON.stringify(value);
	for (const canary of canaries) {
		if (
			typeof canary === "string" &&
			canary.length >= 6 &&
			serialized.includes(canary)
		) {
			throw new Error(
				`Forbidden source canary survived sanitation at ${location}.`,
			);
		}
	}
	return value;
};

export const isValidGtin = (value) => {
	if (
		typeof value !== "string" ||
		!/^\d+$/u.test(value) ||
		!gtinLengths.has(value.length)
	)
		return false;
	return gtinCheckDigit(value.slice(0, -1)) === value.at(-1);
};
