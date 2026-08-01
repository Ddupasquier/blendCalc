import { readModeratorDataHealth } from "$lib/server/moderation/catalogDataHealth.server";
import { requireModeratorAccess } from "$lib/server/moderation/moderationAccess.server";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
	const { role } = await requireModeratorAccess(locals, "/moderation/data-health");
	const dashboard = await readModeratorDataHealth(locals.supabase);

	return {
		viewerRole: role,
		dashboard,
	};
};
