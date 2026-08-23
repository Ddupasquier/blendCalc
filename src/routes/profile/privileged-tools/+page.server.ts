import type { PageServerLoad } from "./$types";
import { requireModeratorPermission } from "$lib/server/moderation/moderationAccess.server";

export const load: PageServerLoad = async ({ locals }) => {
	await requireModeratorPermission(
		locals,
		"moderation.access",
		"/profile/privileged-tools",
	);
	return {};
};
