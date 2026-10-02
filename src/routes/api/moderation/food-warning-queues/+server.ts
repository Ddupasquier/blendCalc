import { json } from "@sveltejs/kit";
import { requireModeratorApiPermission } from "$lib/server/moderation/moderationAccess.server";
import { readFoodWarningQueuePage } from "$lib/server/moderation/foodWarningQueues.server";
import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import { throwAppError } from "$lib/server/errors/appError.server";
import {
	FOOD_WARNING_QUEUE_KEYS,
	readFoodWarningQueueCursor,
	type FoodWarningQueueKey,
} from "$lib/utils/moderation/foodWarningQueuePagination";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals, url }) => {
	await requireModeratorApiPermission(locals, "moderation.warnings.review");
	const queue = url.searchParams.get("queue");
	if (!FOOD_WARNING_QUEUE_KEYS.includes(queue as FoodWarningQueueKey)) {
		throwAppError(400, "INVALID_REQUEST");
	}
	let cursor;
	try {
		cursor = readFoodWarningQueueCursor(url.searchParams.get("cursor"));
	} catch {
		throwAppError(400, "INVALID_REQUEST");
	}
	return json(
		await readFoodWarningQueuePage(
			{ supabase: getSupabaseAdminClient() },
			queue as FoodWarningQueueKey,
			cursor,
		),
		{ headers: { "cache-control": "private, no-store" } },
	);
};
