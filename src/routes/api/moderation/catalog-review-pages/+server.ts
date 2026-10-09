import { json } from "@sveltejs/kit";
import { requireModeratorApiPermission } from "$lib/server/moderation/moderationAccess.server";
import { readCatalogReviewPage } from "$lib/server/moderation/catalogReviewPages.server";
import { throwAppError } from "$lib/server/errors/appError.server";
import {
	CATALOG_REVIEW_QUEUES,
	readCatalogReviewCursor,
	type CatalogReviewQueue,
} from "$lib/utils/moderation/catalogReviewPagination";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals, url }) => {
	await requireModeratorApiPermission(locals, "moderation.catalog.review");
	const queue = url.searchParams.get("queue") as CatalogReviewQueue;
	const productId = url.searchParams.get("product");
	let cursor;
	try {
		if (
			!CATALOG_REVIEW_QUEUES.includes(queue) ||
			(queue === "products"
				? productId !== null
				: !productId ||
					!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
						productId,
					))
		)
			throw new TypeError("Invalid queue.");
		cursor = readCatalogReviewCursor(url.searchParams.get("cursor"));
		if (queue !== "products" && cursor && cursor.priority !== 0)
			throw new TypeError("Invalid priority.");
	} catch {
		throwAppError(400, "INVALID_REQUEST");
	}
	return json(
		await readCatalogReviewPage(locals.supabase, queue, productId, cursor),
		{
			headers: { "cache-control": "private, no-store" },
		},
	);
};
