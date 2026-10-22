import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { requireModeratorPermission } from "$lib/server/moderation/moderationAccess.server";
import { throwAppError } from "$lib/server/errors/appError.server";
import { readLimitedFormData } from "$lib/server/security/requestBody.server";
import type { Json } from "$lib/types/database.types";
import type { ImagePlacementReviewWorkspace } from "$lib/utils/moderation/imagePlacementReview";

const route = "/profile/privileged-tools/image-placement";
const isUuid = (value: string) =>
	/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value);
export const load: PageServerLoad = async ({ locals, url }) => {
	await requireModeratorPermission(locals, "moderation.catalog.review", route);
	const imageId = url.searchParams.get("image");
	if (imageId && !isUuid(imageId))
		throwAppError(400, "IMAGE_PLACEMENT_INVALID");
	const { data, error } = await locals.supabase.rpc(
		"get_food_image_placement_workspace",
		{ p_image_id: imageId ?? undefined },
	);
	if (error || !data) throwAppError(503, "IMAGE_PLACEMENT_SAVE_UNCONFIRMED");
	return { workspace: data as unknown as ImagePlacementReviewWorkspace };
};

export const actions: Actions = {
	review: async ({ locals, request }) => {
		await requireModeratorPermission(
			locals,
			"moderation.catalog.review",
			route,
		);
		const form = await readLimitedFormData(request, 8192);
		const action = String(form.get("action") ?? "");
		const imageId = String(form.get("imageId") ?? "");
		const userId = String(form.get("userId") ?? "");
		const suggestionId = String(form.get("suggestionId") ?? "");
		const revision = form.get("revision");
		const enabled = form.get("enabled");
		const note = String(form.get("note") ?? "").trim();
		if (
			![
				"publish",
				"automation",
				"trust",
				"restrict",
				"lock",
				"approve",
				"reject",
				"undo",
			].includes(action) ||
			[imageId, userId, suggestionId].some(
				(value) => value && !isUuid(value),
			) ||
			(revision !== null &&
				(!Number.isSafeInteger(Number(revision)) || Number(revision) < 0)) ||
			(enabled !== null && !["true", "false"].includes(String(enabled)))
		) {
			return fail(400, { error: "Choose a valid review action." });
		}
		if (note.length > 1000 || (action === "reject" && !note)) {
			return fail(400, {
				error:
					"Add a review note of up to 1,000 characters before rejecting a group.",
			});
		}
		let placement: Json = null;
		const imageUrl = String(form.get("imageUrl") ?? "");
		if (action === "publish") {
			if (
				!imageId ||
				revision === null ||
				!imageUrl ||
				imageUrl.length > 2048
			) {
				return fail(400, {
					error: "Refresh the image before publishing an adjustment.",
				});
			}
			try {
				const parsed: unknown = JSON.parse(String(form.get("placement") ?? ""));
				if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
					return fail(400, { error: "Choose a valid image adjustment." });
				}
				placement = parsed as Json;
			} catch {
				return fail(400, { error: "Choose a valid image adjustment." });
			}
		}
		const { error } =
			action === "publish"
				? await locals.supabase.rpc("publish_food_image_placement", {
						p_image_id: imageId,
						p_image_url: imageUrl,
						p_revision: Number(revision),
						p_placement: placement,
					})
				: await locals.supabase.rpc("review_food_image_placement", {
						p_action: action,
						p_image_id: imageId || undefined,
						p_user_id: userId || undefined,
						p_suggestion_id: suggestionId || undefined,
						p_revision: revision === null ? undefined : Number(revision),
						p_enabled: enabled === null ? undefined : enabled === "true",
						p_note: note,
					});
		if (error)
			return fail(
				error.code === "40001"
					? 409
					: error.code === "42501"
						? 403
						: error.code === "22023"
							? 400
							: error.code === "P0002"
								? 404
								: 503,
				{
					error:
						error.code === "40001"
							? "This image or suggestion changed. Refresh before reviewing it."
							: "We couldn’t apply that decision. Check the inputs and refresh before trying again.",
				},
			);
		return {
			success:
				action === "publish"
					? "Shared image updated."
					: "Image-placement review saved.",
		};
	},
};
