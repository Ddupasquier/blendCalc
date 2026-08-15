import { hashJson } from "./providerProducts.ts";
import type {
	CatalogSafetyMatchCandidate,
	JsonObject,
	NormalizedOfficialSafetyAlert,
	OfficialSafetyAlertIdentifier,
	ProbableSafetyAlertMatch,
	SafetyAlertPage,
} from "./types.ts";

const OPEN_FDA_ENFORCEMENT_URL = "https://api.fda.gov/food/enforcement.json";
const FDA_RECALL_ANNOUNCEMENTS_URL =
	"https://www.fda.gov/datatables-json/recalls-market-withdrawals.json?_format=json";
const FDA_ORIGIN = "https://www.fda.gov";
const FSIS_RECALL_URL = "https://www.fsis.usda.gov/fsis/api/recall/v/1";
const OPEN_FDA_SOURCE_PAGE = "https://open.fda.gov/apis/food/enforcement/";
const FSIS_SOURCE_PAGE = "https://www.fsis.usda.gov/recalls-alerts";
const INITIAL_OPEN_FDA_START_DATE = "20200101";
const MAX_OPEN_FDA_SKIP = 25_000;
const FDA_ANNOUNCEMENT_INITIAL_LOOKBACK_DAYS = 90;
const FDA_ANNOUNCEMENT_REFRESH_LOOKBACK_DAYS = 14;
const FDA_ANNOUNCEMENT_BATCH_SIZE = 10;

const asObject = (value: unknown): JsonObject =>
	value && typeof value === "object" && !Array.isArray(value)
		? value as JsonObject
		: {};

const asString = (value: unknown) =>
	typeof value === "string" && value.trim() ? value.trim() : null;

const asStringArray = (value: unknown) =>
	(Array.isArray(value) ? value : [])
		.flatMap((entry) => {
			const text = asString(entry);
			return text ? [text] : [];
		});

const uniqueStrings = (values: Array<string | null | undefined>) =>
	[...new Set(values.flatMap((value) => value?.trim() ? [value.trim()] : []))];

const decodeHtmlEntities = (value: string) => value
	.replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
	.replace(/&#x([\da-f]+);/gi, (_match, code) =>
		String.fromCodePoint(Number.parseInt(code, 16)))
	.replaceAll("&nbsp;", " ")
	.replaceAll("&amp;", "&")
	.replaceAll("&quot;", '"')
	.replaceAll("&#039;", "'")
	.replaceAll("&apos;", "'")
	.replaceAll("&lt;", "<")
	.replaceAll("&gt;", ">");

const htmlToText = (value: unknown) => {
	const text = asString(value);
	if (!text) return null;
	return decodeHtmlEntities(text.replace(/<[^>]+>/g, " "))
		.replace(/\s+/g, " ")
		.trim() || null;
};

const splitBrandNames = (value: string | null) =>
	uniqueStrings((value ?? "")
		.replace(/\band more\b/gi, "")
		.split(/,|\band\b/i)
		.map((brand) => brand.trim()));

const parseCompactDate = (value: unknown) => {
	const text = asString(value);
	if (!text) return null;
	if (/^\d{8}$/.test(text)) {
		return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
	}
	const shortDateMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
	if (shortDateMatch) {
		return `${shortDateMatch[3]}-${shortDateMatch[1].padStart(2, "0")}-${shortDateMatch[2].padStart(2, "0")}`;
	}
	const parsed = new Date(text);
	return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
};

const dateToCompact = (date: Date) =>
	date.toISOString().slice(0, 10).replaceAll("-", "");

const subtractDays = (timestamp: string, days: number) => {
	const date = new Date(timestamp);
	if (Number.isNaN(date.getTime())) return INITIAL_OPEN_FDA_START_DATE;
	date.setUTCDate(date.getUTCDate() - days);
	return dateToCompact(date);
};

const isValidGtin = (digits: string) => {
	if (![8, 12, 13, 14].includes(digits.length)) return false;
	const checkDigit = Number(digits.at(-1));
	const body = digits.slice(0, -1);
	let sum = 0;
	for (let index = body.length - 1, position = 0; index >= 0; index--, position++) {
		sum += Number(body[index]) * (position % 2 === 0 ? 3 : 1);
	}
	return (10 - (sum % 10)) % 10 === checkDigit;
};

const normalizeGtin = (value: string) => {
	const digits = value.replace(/\D/g, "");
	return isValidGtin(digits) ? digits.padStart(14, "0") : null;
};

const collectLabeledIdentifiers = (text: string) => {
	const identifiers: OfficialSafetyAlertIdentifier[] = [];
	for (const match of text.matchAll(/\b(upc|gtin|ean)(?:\s*(?:code|no\.?|number))?\s*[:#-]?\s*(\d{8,14})\b/gi)) {
		const normalizedValue = normalizeGtin(match[2]);
		if (normalizedValue) {
			identifiers.push({
				type: match[1].toLowerCase() === "upc" ? "upc" : "gtin",
				normalizedValue,
				sourceText: match[0],
			});
		}
	}
	for (const match of text.matchAll(/\blot(?:\s+(?:code|no\.?|number))?\s*[:#-]?\s*([a-z0-9][a-z0-9-]{2,})\b/gi)) {
		identifiers.push({
			type: "lot_code",
			normalizedValue: match[1].toUpperCase(),
			sourceText: match[0],
		});
	}
	for (const match of text.matchAll(/\b(?:use|best)\s+by\s*[:#-]?\s*([a-z0-9/, -]{4,24})/gi)) {
		identifiers.push({
			type: "use_by_date",
			normalizedValue: match[1].trim().toUpperCase(),
			sourceText: match[0],
		});
	}
	return identifiers;
};

const deduplicateIdentifiers = (identifiers: OfficialSafetyAlertIdentifier[]) => {
	const byKey = new Map<string, OfficialSafetyAlertIdentifier>();
	for (const identifier of identifiers) {
		byKey.set(`${identifier.type}:${identifier.normalizedValue}`, identifier);
	}
	return [...byKey.values()].sort((left, right) =>
		`${left.type}:${left.normalizedValue}`.localeCompare(
			`${right.type}:${right.normalizedValue}`,
		)
	);
};

const getFdaAnnouncementSourceUpdatedAt = (record: JsonObject) => {
	const changedMarkup = asString(record.changed) ?? "";
	const datetime = changedMarkup.match(/datetime=["']([^"']+)["']/i)?.[1];
	if (datetime) {
		const parsed = new Date(datetime);
		if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
	}
	const reportDate = parseCompactDate(record.field_change_date_2);
	return reportDate ? `${reportDate}T00:00:00.000Z` : null;
};

const getFdaAnnouncementSourceUrl = (record: JsonObject) => {
	const path = asString(record.path);
	if (!path?.startsWith("/safety/recalls-market-withdrawals-safety-alerts/")) {
		return null;
	}
	return new URL(path, FDA_ORIGIN).toString();
};

const isHumanFoodAnnouncement = (record: JsonObject) => {
	const productTypes = htmlToText(record.field_regulated_product_field) ?? "";
	return /\bFood & Beverages\b/i.test(productTypes) &&
		!/(?:Animal & Veterinary|Pet Food)/i.test(productTypes);
};

export const normalizeFdaRecallAnnouncement = (
	record: JsonObject,
	detailHtml = "",
): NormalizedOfficialSafetyAlert | null => {
	if (!isHumanFoodAnnouncement(record)) return null;
	const sourceUrl = getFdaAnnouncementSourceUrl(record);
	const productDescription = htmlToText(record.field_product_description);
	if (!sourceUrl || !productDescription) return null;
	const reportDate = parseCompactDate(record.field_change_date_2);
	const brandText = htmlToText(record.field_brand_name);
	const recallingOrganization = htmlToText(record.field_company_name);
	const terminatedText = htmlToText(record.field_terminated_recall);
	const identifiers = deduplicateIdentifiers(
		collectLabeledIdentifiers(htmlToText(detailHtml) ?? ""),
	);
	const packageIdentifiers = identifiers.filter((identifier) =>
		identifier.type !== "gtin" && identifier.type !== "upc"
	);
	const path = new URL(sourceUrl).pathname;

	return {
		externalAlertId: `announcement:${path.split("/").filter(Boolean).at(-1)}`,
		recallNumber: null,
		eventId: null,
		alertType: "recall",
		classification: null,
		status: terminatedText ? "terminated" : "active",
		productDescription,
		reason: htmlToText(record.field_recall_reason_description),
		recallingOrganization,
		distributionPattern: null,
		packageDescription: null,
		codeInformation: packageIdentifiers.length > 0
			? packageIdentifiers.map((identifier) => identifier.sourceText).filter(Boolean).join("; ")
			: null,
		sourceUrl,
		reportDate,
		recallInitiatedAt: reportDate,
		terminatedAt: terminatedText ? reportDate : null,
		sourceUpdatedAt: getFdaAnnouncementSourceUpdatedAt(record),
		isActive: !terminatedText,
		brandNames: uniqueStrings([
			...splitBrandNames(brandText),
			recallingOrganization,
		]),
		identifiers,
	};
};

const isOpenFdaAlertActive = (status: string, terminationDate: string | null) => {
	if (terminationDate) return false;
	return !/completed|terminated|closed/i.test(status);
};

export const normalizeOpenFdaAlert = (
	record: JsonObject,
): NormalizedOfficialSafetyAlert | null => {
	const recallNumber = asString(record.recall_number);
	const eventId = asString(record.event_id);
	const productDescription = asString(record.product_description);
	if ((!recallNumber && !eventId) || !productDescription) return null;
	const codeInformation = asString(record.code_info);
	const openFda = asObject(record.openfda);
	const identifiers = deduplicateIdentifiers([
		...asStringArray(openFda.upc).flatMap((upc) => {
			const normalizedValue = normalizeGtin(upc);
			return normalizedValue
				? [{ type: "upc" as const, normalizedValue, sourceText: upc }]
				: [];
		}),
		...collectLabeledIdentifiers(codeInformation ?? ""),
	]);
	const terminatedAt = parseCompactDate(record.termination_date);
	const status = asString(record.status) ?? "unknown";
	const reportDate = parseCompactDate(record.report_date);
	const externalAlertId = recallNumber ?? `event-${eventId}`;

	return {
		externalAlertId,
		recallNumber,
		eventId,
		alertType: "recall",
		classification: asString(record.classification),
		status,
		productDescription,
		reason: asString(record.reason_for_recall),
		recallingOrganization: asString(record.recalling_firm),
		distributionPattern: asString(record.distribution_pattern),
		packageDescription: asString(record.product_quantity),
		codeInformation,
		sourceUrl: recallNumber
			? `${OPEN_FDA_ENFORCEMENT_URL}?search=recall_number:%22${encodeURIComponent(recallNumber)}%22`
			: OPEN_FDA_SOURCE_PAGE,
		reportDate,
		recallInitiatedAt: parseCompactDate(record.recall_initiation_date),
		terminatedAt,
		sourceUpdatedAt: reportDate ? `${reportDate}T00:00:00.000Z` : null,
		isActive: isOpenFdaAlertActive(status, terminatedAt),
		brandNames: uniqueStrings([
			...asStringArray(openFda.brand_name),
			asString(record.recalling_firm),
		]),
		identifiers,
	};
};

const firstString = (record: JsonObject, keys: string[]) => {
	for (const key of keys) {
		const value = asString(record[key]);
		if (value) return value;
	}
	return null;
};

export const normalizeFsisAlert = (
	record: JsonObject,
): NormalizedOfficialSafetyAlert | null => {
	const externalAlertId = firstString(record, [
		"Recall_Number",
		"recall_number",
		"id",
		"RecallID",
	]);
	const productDescription = firstString(record, [
		"Product",
		"product_description",
		"ProductDescription",
		"Title",
	]);
	if (!externalAlertId || !productDescription) return null;
	const codeInformation = firstString(record, [
		"Code_Info",
		"code_information",
		"CodeInformation",
	]);
	const packageDescription = firstString(record, [
		"Product_Quantity",
		"package_description",
		"PackageDescription",
	]);
	const status = firstString(record, ["Status", "status"]) ?? "active";
	const sourceUrl = firstString(record, [
		"Recall_URL",
		"recall_url",
		"url",
	]) ?? FSIS_SOURCE_PAGE;
	const reportDate = parseCompactDate(firstString(record, [
		"Recall_Date",
		"report_date",
		"PublicationDate",
	]));
	return {
		externalAlertId,
		recallNumber: externalAlertId,
		eventId: firstString(record, ["Event_ID", "event_id"]),
		alertType: /public health alert/i.test(productDescription)
			? "public_health_alert"
			: "recall",
		classification: firstString(record, ["Class", "classification"]),
		status,
		productDescription,
		reason: firstString(record, ["Reason", "reason_for_recall"]),
		recallingOrganization: firstString(record, ["Company", "recalling_firm"]),
		distributionPattern: firstString(record, ["Distribution", "distribution_pattern"]),
		packageDescription,
		codeInformation,
		sourceUrl: sourceUrl.startsWith("https://") ? sourceUrl : FSIS_SOURCE_PAGE,
		reportDate,
		recallInitiatedAt: reportDate,
		terminatedAt: parseCompactDate(firstString(record, ["Termination_Date", "termination_date"])),
		sourceUpdatedAt: reportDate ? `${reportDate}T00:00:00.000Z` : null,
		isActive: !/closed|completed|terminated/i.test(status),
		brandNames: uniqueStrings([
			firstString(record, ["Brand", "brand_name"]),
			firstString(record, ["Company", "recalling_firm"]),
		]),
		identifiers: deduplicateIdentifiers(
			collectLabeledIdentifiers(`${codeInformation ?? ""} ${packageDescription ?? ""}`),
		),
	};
};

const fetchSafetyAlertJson = async (url: URL, allowEmpty404 = false) => {
	const response = await fetch(url, {
		headers: {
			accept: "application/json",
			"user-agent": "blendCalc catalog safety monitor",
		},
		signal: AbortSignal.timeout(20_000),
	});
	if (allowEmpty404 && response.status === 404) return {};
	if (response.status === 429) {
		throw new SafetyAlertRequestError("Safety alert provider rate limited the request", "rate_limited");
	}
	if (!response.ok) {
		throw new SafetyAlertRequestError(
			`Safety alert provider returned ${response.status}`,
			"provider_unavailable",
		);
	}
	const value = await response.json();
	if (!value || typeof value !== "object") {
		throw new SafetyAlertRequestError("Safety alert provider response was invalid", "invalid_response");
	}
	return value;
};

const fetchSafetyAlertText = async (url: URL) => {
	const response = await fetch(url, {
		headers: {
			accept: "text/html",
			"user-agent": "blendCalc catalog safety monitor",
		},
		signal: AbortSignal.timeout(20_000),
	});
	if (!response.ok) return "";
	return await response.text();
};

type FdaAnnouncementDataset = {
	records: JsonObject[];
	etag: string | null;
	lastModified: string | null;
	notModified: boolean;
};

const fetchFdaAnnouncementDataset = async (
	etag: string | null,
	lastModified: string | null,
): Promise<FdaAnnouncementDataset> => {
	const headers = new Headers({
		accept: "application/json",
		"user-agent": "blendCalc catalog safety monitor",
	});
	if (etag) headers.set("if-none-match", etag);
	if (lastModified) headers.set("if-modified-since", lastModified);
	const response = await fetch(FDA_RECALL_ANNOUNCEMENTS_URL, {
		headers,
		signal: AbortSignal.timeout(20_000),
	});
	if (response.status === 304) {
		return { records: [], etag, lastModified, notModified: true };
	}
	if (response.status === 429) {
		throw new SafetyAlertRequestError(
			"FDA recall announcements rate limited the request",
			"rate_limited",
		);
	}
	if (!response.ok) {
		throw new SafetyAlertRequestError(
			`FDA recall announcements returned ${response.status}`,
			"provider_unavailable",
		);
	}
	const value = await response.json();
	if (!Array.isArray(value)) {
		throw new SafetyAlertRequestError(
			"FDA recall announcements response was invalid",
			"invalid_response",
		);
	}
	return {
		records: value.map(asObject),
		etag: response.headers.get("etag"),
		lastModified: response.headers.get("last-modified"),
		notModified: false,
	};
};

export class SafetyAlertRequestError extends Error {
	constructor(
		message: string,
		public readonly code: "rate_limited" | "provider_unavailable" | "invalid_response",
	) {
		super(message);
	}
}

const fetchOpenFdaEnforcementAlertPage = async (
	lastSuccessfulAt: string | null,
	cursor: JsonObject,
	pageSize: number,
	apiKey?: string,
): Promise<SafetyAlertPage> => {
	const cursorStartDate = asString(cursor.startDate);
	const startDate = cursorStartDate ?? (
		lastSuccessfulAt
			? subtractDays(lastSuccessfulAt, 7)
			: INITIAL_OPEN_FDA_START_DATE
	);
	const skip = Math.max(0, Number(cursor.skip) || 0);
	const limit = Math.max(1, Math.min(pageSize, 1000));
	const url = new URL(OPEN_FDA_ENFORCEMENT_URL);
	url.searchParams.set("search", `report_date:[${startDate} TO 99991231]`);
	url.searchParams.set("sort", "report_date:asc");
	url.searchParams.set("limit", String(limit));
	url.searchParams.set("skip", String(Math.min(skip, MAX_OPEN_FDA_SKIP)));
	if (apiKey) url.searchParams.set("api_key", apiKey);
	const response = asObject(await fetchSafetyAlertJson(url, true));
	const records = Array.isArray(response.results) ? response.results : [];
	const alerts = await Promise.all(records.flatMap((entry) => {
		const rawPayload = asObject(entry);
		const normalizedAlert = normalizeOpenFdaAlert(rawPayload);
		return normalizedAlert ? [{ rawPayload, normalizedAlert }] : [];
	}).map(async ({ rawPayload, normalizedAlert }) => ({
		rawPayload,
		normalizedAlert,
		contentHash: await hashJson(normalizedAlert),
	})));
	const hasMore = records.length === limit && skip + limit < MAX_OPEN_FDA_SKIP;
	return {
		providerKey: "open-fda-food-enforcement",
		alerts,
		nextCursor: hasMore
			? { startDate, skip: skip + limit, hasMore: true }
			: { startDate: subtractDays(new Date().toISOString(), 7), skip: 0, hasMore: false },
		sourceUpdatedAt: alerts
			.map(({ normalizedAlert }) => normalizedAlert.sourceUpdatedAt)
			.filter((value): value is string => Boolean(value))
			.sort()
			.at(-1) ?? null,
	};
};

const fetchFdaRecallAnnouncementPage = async (
	lastSuccessfulAt: string | null,
	cursor: JsonObject,
	pageSize: number,
): Promise<SafetyAlertPage> => {
	const offset = Math.max(0, Number(cursor.fdaAnnouncementOffset) || 0);
	const previousSweepComplete = cursor.fdaAnnouncementSweepComplete === true;
	const hasAnnouncementCursor = previousSweepComplete ||
		asString(cursor.fdaAnnouncementCutoffDate) !== null ||
		asString(cursor.fdaAnnouncementEtag) !== null ||
		offset > 0;
	const cutoffDate = asString(cursor.fdaAnnouncementCutoffDate) ?? (
		hasAnnouncementCursor && lastSuccessfulAt
			? parseCompactDate(subtractDays(
				lastSuccessfulAt,
				FDA_ANNOUNCEMENT_REFRESH_LOOKBACK_DAYS,
			))
			: parseCompactDate(subtractDays(
				new Date().toISOString(),
				FDA_ANNOUNCEMENT_INITIAL_LOOKBACK_DAYS,
			))
	);
	const dataset = await fetchFdaAnnouncementDataset(
		offset === 0 && previousSweepComplete ? asString(cursor.fdaAnnouncementEtag) : null,
		offset === 0 && previousSweepComplete
			? asString(cursor.fdaAnnouncementLastModified)
			: null,
	);
	if (dataset.notModified) {
		return {
			providerKey: "open-fda-food-enforcement",
			alerts: [],
			nextCursor: {
				fdaAnnouncementOffset: 0,
				fdaAnnouncementCutoffDate: cutoffDate,
				fdaAnnouncementEtag: dataset.etag,
				fdaAnnouncementLastModified: dataset.lastModified,
				fdaAnnouncementSweepComplete: true,
				hasMore: false,
			},
			sourceUpdatedAt: null,
		};
	}

	const eligibleRecords = dataset.records
		.flatMap((record) => {
			const alert = normalizeFdaRecallAnnouncement(record);
			return alert && (!cutoffDate || (alert.reportDate ?? "") >= cutoffDate)
				? [{ record, alert }]
				: [];
		})
		.sort((left, right) =>
			(left.alert.reportDate ?? "").localeCompare(right.alert.reportDate ?? "") ||
			left.alert.externalAlertId.localeCompare(right.alert.externalAlertId)
		);
	const limit = Math.max(1, Math.min(pageSize, FDA_ANNOUNCEMENT_BATCH_SIZE));
	const selectedRecords = eligibleRecords.slice(offset, offset + limit);
	const alerts = await Promise.all(selectedRecords.map(async ({ record, alert }) => {
		const detailHtml = await fetchSafetyAlertText(new URL(alert.sourceUrl));
		const normalizedAlert = normalizeFdaRecallAnnouncement(record, detailHtml) ?? alert;
		const rawPayload: JsonObject = {
			announcement: record,
			extractedIdentifiers: normalizedAlert.identifiers,
		};
		return {
			rawPayload,
			normalizedAlert,
			contentHash: await hashJson(normalizedAlert),
		};
	}));
	const nextOffset = offset + selectedRecords.length;
	const hasMore = nextOffset < eligibleRecords.length;

	return {
		providerKey: "open-fda-food-enforcement",
		alerts,
		nextCursor: {
			fdaAnnouncementOffset: hasMore ? nextOffset : 0,
			fdaAnnouncementCutoffDate: hasMore ? cutoffDate : parseCompactDate(subtractDays(
				new Date().toISOString(),
				FDA_ANNOUNCEMENT_REFRESH_LOOKBACK_DAYS,
			)),
			fdaAnnouncementEtag: dataset.etag,
			fdaAnnouncementLastModified: dataset.lastModified,
			fdaAnnouncementSweepComplete: !hasMore,
			hasMore,
		},
		sourceUpdatedAt: alerts
			.map(({ normalizedAlert }) => normalizedAlert.sourceUpdatedAt)
			.filter((value): value is string => Boolean(value))
			.sort()
			.at(-1) ?? null,
	};
};

export const fetchOpenFdaAlertPage = async (
	lastSuccessfulAt: string | null,
	cursor: JsonObject,
	pageSize: number,
	apiKey?: string,
): Promise<SafetyAlertPage> => {
	const [enforcementPage, announcementPage] = await Promise.all([
		fetchOpenFdaEnforcementAlertPage(lastSuccessfulAt, cursor, pageSize, apiKey),
		fetchFdaRecallAnnouncementPage(lastSuccessfulAt, cursor, pageSize),
	]);
	const latestSourceUpdate = [
		enforcementPage.sourceUpdatedAt,
		announcementPage.sourceUpdatedAt,
	].filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;

	return {
		providerKey: "open-fda-food-enforcement",
		alerts: [...enforcementPage.alerts, ...announcementPage.alerts],
		nextCursor: {
			...enforcementPage.nextCursor,
			...announcementPage.nextCursor,
			hasMore: enforcementPage.nextCursor.hasMore === true ||
				announcementPage.nextCursor.hasMore === true,
		},
		sourceUpdatedAt: latestSourceUpdate,
	};
};

export const fetchFsisAlertPage = async (): Promise<SafetyAlertPage> => {
	const response = await fetchSafetyAlertJson(new URL(FSIS_RECALL_URL));
	const object = asObject(response);
	const records = Array.isArray(response)
		? response
		: Array.isArray(object.results)
			? object.results
			: Array.isArray(object.data)
				? object.data
				: [];
	const alerts = await Promise.all(records.flatMap((entry) => {
		const rawPayload = asObject(entry);
		const normalizedAlert = normalizeFsisAlert(rawPayload);
		return normalizedAlert ? [{ rawPayload, normalizedAlert }] : [];
	}).map(async ({ rawPayload, normalizedAlert }) => ({
		rawPayload,
		normalizedAlert,
		contentHash: await hashJson(normalizedAlert),
	})));
	return {
		providerKey: "usda-fsis-recalls",
		alerts,
		nextCursor: { hasMore: false },
		sourceUpdatedAt: alerts
			.map(({ normalizedAlert }) => normalizedAlert.sourceUpdatedAt)
			.filter((value): value is string => Boolean(value))
			.sort()
			.at(-1) ?? null,
	};
};

const WORDS_TO_IGNORE = new Set([
	"and", "the", "with", "food", "foods", "product", "products", "brand",
	"company", "inc", "llc", "co", "pack", "package", "packages", "oz", "lb",
]);

const words = (value: string | null | undefined) =>
	new Set((value ?? "")
		.normalize("NFKD")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim()
		.split(/\s+/)
		.filter((word) => word.length > 1 && !WORDS_TO_IGNORE.has(word)));

const overlapRatio = (left: Set<string>, right: Set<string>) => {
	if (left.size === 0 || right.size === 0) return 0;
	const intersection = [...left].filter((word) => right.has(word)).length;
	return intersection / Math.min(left.size, right.size);
};

const packageAmount = (value: string | null | undefined) => {
	const match = value?.toLowerCase().match(/\b(\d+(?:\.\d+)?)\s*(fl\s*oz|oz|lb|g|kg|ml|l)\b/);
	return match ? `${Number(match[1])}:${match[2].replaceAll(" ", "")}` : null;
};

export const buildProbableSafetyAlertMatches = (
	alert: NormalizedOfficialSafetyAlert,
	candidates: CatalogSafetyMatchCandidate[],
): ProbableSafetyAlertMatch[] => {
	if (alert.identifiers.some((identifier) => ["gtin", "upc"].includes(identifier.type))) {
		return [];
	}
	const alertBrandWords = alert.brandNames.map(words).filter((value) => value.size > 0);
	const alertProductWords = words(alert.productDescription);
	const alertPackageAmount = packageAmount(alert.packageDescription);
	if (alertBrandWords.length === 0 || alertProductWords.size < 2) return [];

	return candidates.flatMap((candidate) => {
		const candidateBrandWords = words(candidate.brand_owner);
		if (candidateBrandWords.size === 0) return [];
		const brandAgreement = Math.max(
			...alertBrandWords.map((brandWords) => overlapRatio(brandWords, candidateBrandWords)),
		);
		if (brandAgreement < 0.8) return [];
		const productAgreement = overlapRatio(alertProductWords, words(candidate.product_name));
		if (productAgreement < 0.6) return [];
		const food = asObject(candidate.food);
		const packageValue = asString(asObject(food.packageQuantity).label) ??
			asString(food.packageWeight);
		const candidatePackageAmount = packageAmount(packageValue);
		if (
			alertPackageAmount &&
			candidatePackageAmount &&
			alertPackageAmount !== candidatePackageAmount
		) return [];
		return [{
			sharedProductId: candidate.id,
			evidence: {
				matchBasis: "brand_product_package",
				brandAgreement,
				productAgreement,
				packageAgreement: alertPackageAmount && candidatePackageAmount
					? true
					: null,
				requiresModeratorReview: true,
			},
		}];
	});
};
