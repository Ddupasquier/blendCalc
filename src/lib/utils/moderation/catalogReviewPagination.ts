import type { CatalogCorrectionFinding } from "$lib/server/moderation/catalogCorrectionHandoff.server";
import type {
	CatalogReviewProductSummary,
	CatalogReviewWorkSummary,
} from "./catalogReviewWork";
import { readFoodWarningQueueCursor } from "./foodWarningQueuePagination";

export const CATALOG_REVIEW_PAGE_SIZE = 20;
export const CATALOG_CONFLICT_REVIEW_LIMIT = 200;
export const CATALOG_REVIEW_QUEUES = [
	"products",
	"conflicts",
	"providerChanges",
	"safetyMatches",
] as const;
export type CatalogReviewQueue = (typeof CATALOG_REVIEW_QUEUES)[number];
export type CatalogReviewCursor = {
	createdAt: string;
	id: string;
	priority: 0 | 1;
};
export type CatalogReviewPageRows = {
	products: CatalogReviewProductSummary & { id: string };
	conflicts: CatalogCorrectionFinding;
	providerChanges: CatalogReviewWorkSummary["providerChanges"][number];
	safetyMatches: CatalogReviewWorkSummary["safetyMatches"][number];
};
export type CatalogReviewPage<Key extends CatalogReviewQueue> = {
	items: CatalogReviewPageRows[Key][];
	total: number;
	nextCursor: string | null;
	revision: string;
	counts: CatalogReviewWorkSummary["counts"];
};
export type CatalogReviewProductPages = {
	[Key in Exclude<CatalogReviewQueue, "products">]: CatalogReviewPage<Key>;
};

export const readCatalogReviewCursor = (
	value: string | null,
): CatalogReviewCursor | null => {
	if (value === null) return null;
	if (value.length > 220) throw new TypeError("Invalid catalog review cursor.");
	const record = JSON.parse(value);
	if (
		!record ||
		typeof record !== "object" ||
		Array.isArray(record) ||
		Object.keys(record).length !== 3 ||
		![0, 1].includes(record.priority)
	) {
		throw new TypeError("Invalid catalog review cursor.");
	}
	const cursor = readFoodWarningQueueCursor(
		JSON.stringify({ createdAt: record.createdAt, id: record.id }),
	);
	if (!cursor) throw new TypeError("Invalid catalog review cursor.");
	return { ...cursor, priority: record.priority };
};

export const fetchCatalogReviewPage = async <Key extends CatalogReviewQueue>(
	queue: Key,
	productId: string | null,
	cursor: string | null,
	signal: AbortSignal,
): Promise<CatalogReviewPage<Key>> => {
	const params = new URLSearchParams({ queue });
	if (productId) params.set("product", productId);
	if (cursor) params.set("cursor", cursor);
	const response = await fetch(
		`/api/moderation/catalog-review-pages?${params}`,
		{
			signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
		},
	);
	if (!response.ok) throw new Error("Catalog review unavailable.");
	return response.json();
};
