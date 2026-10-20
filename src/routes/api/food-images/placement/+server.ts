import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
	requireAppValue,
	throwAppError,
} from "$lib/server/errors/appError.server";
import { readLimitedJson } from "$lib/server/security/requestBody.server";
import type { Json } from "$lib/types/database.types";

export const POST: RequestHandler = async ({ locals, request }) => {
	requireAppValue(await locals.getVerifiedUser(), 401, "AUTH_REQUIRED");
	const body = (await readLimitedJson(request, 4096)) as Record<
		string,
		unknown
	> | null;
	if (
		!body ||
		!["personal", "reset", "suggest"].includes(String(body.action)) ||
		typeof body.imageId !== "string" ||
		!/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(body.imageId) ||
		typeof body.imageUrl !== "string" ||
		body.imageUrl.length > 2048 ||
		(body.action === "suggest" &&
			(!Number.isSafeInteger(body.baseRevision) ||
				Number(body.baseRevision) < 0))
	) {
		return throwAppError(400, "IMAGE_PLACEMENT_INVALID");
	}
	const { data, error } = await locals.supabase.rpc(
		"save_food_image_placement",
		{
			p_image_id: body.imageId,
			p_image_url: body.imageUrl,
			p_action: String(body.action),
			p_placement: (body.placement ?? null) as Json,
			p_base_revision:
				body.action === "suggest" ? Number(body.baseRevision) : undefined,
		},
	);
	if (error) {
		if (error.code === "42501") throwAppError(403, "ACCESS_DENIED");
		if (error.code === "P0002") throwAppError(404, "IMAGE_NOT_FOUND");
		if (error.code === "22023") throwAppError(400, "IMAGE_PLACEMENT_INVALID");
		throwAppError(503, "IMAGE_PLACEMENT_SAVE_UNCONFIRMED");
	}
	return json(data, { headers: { "Cache-Control": "private, no-store" } });
};
