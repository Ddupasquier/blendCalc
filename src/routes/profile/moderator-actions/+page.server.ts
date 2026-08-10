import type { PageServerLoad } from "./$types";
import { requireModeratorAccess } from "$lib/server/moderation/moderationAccess.server";

export const load: PageServerLoad = async ({ locals }) => {
	await requireModeratorAccess(locals, "/profile/moderator-actions");
	return {};
};
