import type { Json } from "$lib/types/database.types";

export const FOOD_WARNING_QUEUE_PAGE_SIZE = 10;
export const FOOD_WARNING_QUEUE_KEYS = [
	"reports",
	"productCorrections",
	"policyReviews",
] as const;
export type FoodWarningQueueKey = (typeof FOOD_WARNING_QUEUE_KEYS)[number];
export type FoodWarningQueueCursor = { createdAt: string; id: string };
export type FoodWarningQueuePage<Row> = {
	items: Row[];
	total: number;
	nextCursor: string | null;
};

export type FoodWarningReport = {
	id: string;
	feedbackType: string;
	reportedBy: string;
	sharedProductId: string | null;
	sharedProductRevisionId: string | null;
	sourceKey: string | null;
	sourceId: string | null;
	barcode: string | null;
	foodDescription: string;
	warningId: string | null;
	issueCode: string | null;
	issueParams: Json;
	factSnapshot: Json;
	preferenceType: string | null;
	preferenceValue: string | null;
	observedLabelDate: string | null;
	evidenceUrl: string | null;
	reportReason: string;
	reportDetails: string | null;
	createdAt: string;
	policyVersion: number | null;
};

export type FoodWarningProductCorrection = {
	id: string;
	sharedProductId: string;
	productName: string;
	barcode: string;
	affectedFieldPaths: string[];
	status: string;
	submissionId: string | null;
	feedbackType: string;
	reportReason: string;
	createdAt: string;
};

export type FoodWarningPolicyReview = {
	id: string;
	caseType: string;
	responsibleGroup: string;
	sharedProductId: string | null;
	productName: string;
	barcode: string | null;
	sourceKey: string | null;
	status: string;
	feedbackType: string;
	reportReason: string;
	createdAt: string;
};

export type FoodWarningQueueRows = {
	reports: FoodWarningReport;
	productCorrections: FoodWarningProductCorrection;
	policyReviews: FoodWarningPolicyReview;
};
export type FoodWarningQueuePages = {
	[Key in FoodWarningQueueKey]: FoodWarningQueuePage<FoodWarningQueueRows[Key]>;
};

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
// Preserve PostgreSQL microseconds: converting through Date would skip tied rows.
const TIMESTAMP_PATTERN =
	/^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/u;

const isValidTimestamp = (value: string) => {
	const match = TIMESTAMP_PATTERN.exec(value);
	if (!match || !Number.isFinite(Date.parse(value))) return false;
	const [year, month, day] = match.slice(1, 4).map(Number);
	const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
	const days = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
	return (
		year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]
	);
};

export const encodeFoodWarningQueueCursor = (cursor: FoodWarningQueueCursor) =>
	JSON.stringify(cursor);

export const readFoodWarningQueueCursor = (
	value: string | null,
): FoodWarningQueueCursor | null => {
	if (value === null) return null;
	if (value.length > 180) throw new TypeError("Invalid warning queue cursor.");
	let candidate: unknown;
	try {
		candidate = JSON.parse(value);
	} catch {
		throw new TypeError("Invalid warning queue cursor.");
	}
	if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
		throw new TypeError("Invalid warning queue cursor.");
	}
	const record = candidate as Record<string, unknown>;
	if (
		Object.keys(record).length !== 2 ||
		typeof record.id !== "string" ||
		!UUID_PATTERN.test(record.id) ||
		typeof record.createdAt !== "string" ||
		!isValidTimestamp(record.createdAt)
	) {
		throw new TypeError("Invalid warning queue cursor.");
	}
	return { id: record.id, createdAt: record.createdAt };
};

export const emptyFoodWarningQueuePage = <
	Row,
>(): FoodWarningQueuePage<Row> => ({
	items: [],
	total: 0,
	nextCursor: null,
});
