import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "$lib/types/database.types";
import { throwAppError } from "$lib/server/errors/appError.server";
import { readCatalogCorrectionHandoff } from "./catalogCorrectionHandoff.server";
import { parseCatalogReviewWorkSummary } from "$lib/utils/moderation/catalogReviewWork";
import {
	CATALOG_REVIEW_PAGE_SIZE,
	readCatalogReviewCursor,
	type CatalogReviewPage,
	type CatalogReviewQueue,
	type CatalogReviewCursor,
	type CatalogReviewProductPages,
} from "$lib/utils/moderation/catalogReviewPagination";

const record = (value: unknown): Record<string, unknown> => {
	if (!value || typeof value !== "object" || Array.isArray(value))
		throw new TypeError("Invalid catalog page.");
	return value as Record<string, unknown>;
};
const count = (value: unknown): number => {
	if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
		throw new TypeError("Invalid catalog count.");
	return value;
};
const text = (value: unknown): string => {
	if (typeof value !== "string")
		throw new TypeError("Invalid catalog identity.");
	return value;
};

export const readCatalogReviewPage = async <Key extends CatalogReviewQueue>(
	supabase: SupabaseClient<Database>,
	queue: Key,
	productId: string | null = null,
	cursor: CatalogReviewCursor | null = null,
): Promise<CatalogReviewPage<Key>> => {
	const { data, error } = await supabase.rpc("get_catalog_review_page", {
		p_queue: queue,
		p_product_id: productId ?? undefined,
		p_cursor: (cursor as Json) ?? undefined,
		p_limit: CATALOG_REVIEW_PAGE_SIZE,
	});
	if (error || data === null) throwAppError(502, "MODERATION_DATA_UNAVAILABLE");
	try {
		const root = record(data);
		if (
			!Array.isArray(root.items) ||
			root.items.length > CATALOG_REVIEW_PAGE_SIZE ||
			typeof root.revision !== "string" ||
			!/^[a-f0-9]{32}$/u.test(root.revision)
		)
			throw new TypeError("Invalid catalog page.");
		const rawCounts = record(root.counts);
		const counts = {
			conflicts: count(rawCounts.conflicts),
			providerChanges: count(rawCounts.providerChanges),
			safetyMatches: count(rawCounts.safetyMatches),
		};
		const nextCursor =
			root.nextCursor === null
				? null
				: JSON.stringify(
						readCatalogReviewCursor(JSON.stringify(root.nextCursor)),
					);
		let items: unknown[];
		if (queue === "products") {
			items = root.items.map((value) => {
				const item = record(value),
					totals = record(item.counts);
				const productCounts = {
					conflicts: count(totals.conflicts),
					providerChanges: count(totals.providerChanges),
					safetyMatches: count(totals.safetyMatches),
					total: count(totals.total),
				};
				if (
					productCounts.total !==
					productCounts.conflicts +
						productCounts.providerChanges +
						productCounts.safetyMatches
				)
					throw new TypeError("Invalid product total.");
				return {
					id: text(item.id),
					productId: text(item.productId),
					productName: text(item.productName),
					barcode: text(item.barcode),
					brandOwner: item.brandOwner === null ? null : text(item.brandOwner),
					oldestReviewAt: text(item.oldestReviewAt),
					counts: productCounts,
				};
			});
		} else {
			const work = parseCatalogReviewWorkSummary({
				conflicts: [],
				providerChanges: [],
				safetyMatches: [],
				[queue]: root.items,
				counts,
				issueLimit: CATALOG_REVIEW_PAGE_SIZE,
			});
			if (queue === "conflicts") {
				const handoff = await readCatalogCorrectionHandoff(
					productId!,
					[],
					work.conflicts.map((item) => item.id),
				);
				const findings = new Map(
					handoff.findings
						.filter(
							(item) =>
								item.type === "catalog_conflict" &&
								item.status === "needs_correction",
						)
						.map((item) => [item.id, item]),
				);
				items = work.conflicts.map((item) => {
					const finding = findings.get(item.id);
					if (!finding)
						throw new TypeError("Catalog evidence changed during read.");
					return finding;
				});
			} else
				items =
					queue === "providerChanges"
						? work.providerChanges
						: work.safetyMatches;
		}
		return {
			items,
			total: count(root.total),
			counts,
			nextCursor,
			revision: root.revision,
		} as CatalogReviewPage<Key>;
	} catch {
		return throwAppError(502, "MODERATION_DATA_UNAVAILABLE");
	}
};

export const readCatalogReviewProductPages = async (
	supabase: SupabaseClient<Database>,
	productId: string,
): Promise<CatalogReviewProductPages> => {
	// The product workspace owns admission; page reads do not repeat its writes.
	const [conflicts, providerChanges, safetyMatches] = await Promise.all([
		readCatalogReviewPage(supabase, "conflicts", productId),
		readCatalogReviewPage(supabase, "providerChanges", productId),
		readCatalogReviewPage(supabase, "safetyMatches", productId),
	]);
	return { conflicts, providerChanges, safetyMatches };
};
