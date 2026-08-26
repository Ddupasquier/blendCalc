import type { RequestEvent } from "@sveltejs/kit";
import { readCatalogProductReadinessPassport } from "$lib/server/moderation/catalogProductReadinessPassport.server";
import { requireModeratorPermission } from "$lib/server/moderation/moderationAccess.server";
import type { AppPermission } from "$lib/utils/moderation/moderation";

type CatalogProductReadinessPassportLoadEvent = Pick<
	RequestEvent,
	"locals" | "params"
>;

export const loadCatalogProductReadinessPassportWorkspace = async (
	{ locals, params }: CatalogProductReadinessPassportLoadEvent,
	permission: AppPermission,
	returnPath: string,
) => {
	const { role } = await requireModeratorPermission(
		locals,
		permission,
		returnPath,
	);
	const productId = params.productId ?? "";
	if (!productId) throw new TypeError("Catalog product ID is required.");

	return {
		viewerRole: role,
		passport: await readCatalogProductReadinessPassport(
			locals.supabase,
			productId,
		),
	};
};

export type CatalogProductReadinessPassportWorkspaceData = Awaited<
	ReturnType<typeof loadCatalogProductReadinessPassportWorkspace>
>;
