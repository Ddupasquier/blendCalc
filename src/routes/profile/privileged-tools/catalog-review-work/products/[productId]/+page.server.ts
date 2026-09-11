import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { loadCatalogProductReadinessPassportWorkspace } from "$lib/server/moderation/catalogProductReadinessPassportWorkspace.server";
import { readCatalogCorrectionHandoff } from "$lib/server/moderation/catalogCorrectionHandoff.server";
import { requireModeratorPermission } from "$lib/server/moderation/moderationAccess.server";
import { readLimitedFormData } from "$lib/server/security/requestBody.server";

const CATALOG_PRODUCT_ROUTE = "/profile/privileged-tools/catalog-review-work";
const CATALOG_PRODUCT_FORM_MAX_BYTES = 32 * 1024;

export const load: PageServerLoad = async (event) => {
	const workspace = await loadCatalogProductReadinessPassportWorkspace(
		event,
		"moderation.catalog.review",
		"/profile/privileged-tools/catalog-review-work",
	);
	return {
		...workspace,
		correctionHandoff: await readCatalogCorrectionHandoff(
			event.params.productId,
			workspace.passport.issues,
		),
	};
};

export const actions: Actions = {
	resolveConflictWithoutCorrection: async ({ locals, request, params }) => {
		await requireModeratorPermission(
			locals,
			"moderation.catalog.review",
			CATALOG_PRODUCT_ROUTE,
		);
		const formData = await readLimitedFormData(
			request,
			CATALOG_PRODUCT_FORM_MAX_BYTES,
		);
		const conflictId = String(formData.get("conflictId") ?? "");
		const resolutionNote = String(formData.get("resolutionNote") ?? "").trim();
		if (!conflictId || !resolutionNote) {
			return fail(400, {
				catalogReviewError:
					"Explain why the current value is better supported before resolving the conflict.",
			});
		}
		const { error } = await locals.supabase.rpc(
			"resolve_catalog_conflict_without_correction",
			{
				p_conflict_id: conflictId,
				p_shared_product_id: params.productId,
				p_resolution_note: resolutionNote,
			},
		);
		if (error) {
			return fail(409, {
				catalogReviewError: error.message.includes("linked catalog correction")
					? "Review the linked catalog correction before resolving this conflict."
					: "That conflict could not be resolved. Refresh and confirm it is still waiting for review.",
			});
		}
		return {
			catalogReviewSuccess:
				"The current value remains unchanged and this conflict is resolved. API readiness was recalculated.",
		};
	},
};
