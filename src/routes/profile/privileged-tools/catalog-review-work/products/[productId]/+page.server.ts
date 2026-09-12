import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { loadCatalogProductReadinessPassportWorkspace } from "$lib/server/moderation/catalogProductReadinessPassportWorkspace.server";
import { readCatalogCorrectionHandoff } from "$lib/server/moderation/catalogCorrectionHandoff.server";
import { readCatalogReviewWork } from "$lib/server/moderation/catalogReviewWork.server";
import { catalogReviewWorkWorkspaceActions } from "$lib/server/moderation/catalogReviewWorkWorkspace.server";
import { requireModeratorPermission } from "$lib/server/moderation/moderationAccess.server";
import { getApprovedCatalogRecordByApplicationFoodId } from "$lib/server/products/catalogRead.server";
import { readLimitedFormData } from "$lib/server/security/requestBody.server";
import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import {
	filterCatalogReviewWorkForProduct,
	groupCatalogReviewWorkByProduct,
} from "$lib/utils/moderation/catalogReviewWork";

const CATALOG_PRODUCT_ROUTE = "/profile/privileged-tools/catalog-review-work";
const CATALOG_PRODUCT_FORM_MAX_BYTES = 32 * 1024;

export const load: PageServerLoad = async (event) => {
	const workspace = await loadCatalogProductReadinessPassportWorkspace(
		event,
		"moderation.catalog.review",
		"/profile/privileged-tools/catalog-review-work",
	);
	const reviewWork = await readCatalogReviewWork(event.locals.supabase);
	const correctionHandoff = await readCatalogCorrectionHandoff(
		event.params.productId,
		workspace.passport.issues,
	);
	const correctionRecord = correctionHandoff.applicationFoodId
		? await getApprovedCatalogRecordByApplicationFoodId(
				getSupabaseAdminClient(),
				correctionHandoff.applicationFoodId,
			)
		: null;
	return {
		...workspace,
		reviewWork: filterCatalogReviewWorkForProduct(
			reviewWork,
			event.params.productId,
		),
		correctionHandoff,
		correctionFood: correctionRecord?.food ?? null,
	};
};

export const actions: Actions = {
	finishConflictReview: async ({ locals, request, params }) => {
		await requireModeratorPermission(
			locals,
			"moderation.catalog.review",
			CATALOG_PRODUCT_ROUTE,
		);
		const formData = await readLimitedFormData(
			request,
			CATALOG_PRODUCT_FORM_MAX_BYTES,
		);
		let decisions: unknown;
		try {
			decisions = JSON.parse(String(formData.get("decisions") ?? ""));
		} catch {
			return fail(400, {
				catalogReviewError:
					"The decisions could not be read. Refresh and review each conflict again.",
			});
		}
		if (
			!Array.isArray(decisions) ||
			decisions.length < 1 ||
			decisions.length > 50
		) {
			return fail(400, {
				catalogReviewError:
					"Choose one outcome for every current catalog conflict before finishing.",
			});
		}
		const { error } = await locals.supabase.rpc(
			"finish_catalog_conflict_review",
			{
				p_shared_product_id: params.productId,
				p_decisions: decisions,
			},
		);
		if (error) {
			return fail(error.code === "40001" ? 409 : 400, {
				catalogReviewError:
					error.code === "40001"
						? "The evidence changed while you were reviewing it. Refresh and decide the current conflicts."
						: error.message,
			});
		}

		const refreshedWork = await readCatalogReviewWork(locals.supabase);
		const nextProduct = groupCatalogReviewWorkByProduct(refreshedWork).find(
			(product) => product.productId !== params.productId,
		);
		redirect(
			303,
			nextProduct
				? `${CATALOG_PRODUCT_ROUTE}/products/${encodeURIComponent(nextProduct.productId)}`
				: CATALOG_PRODUCT_ROUTE,
		);
	},
	reviewSafetyMatch: catalogReviewWorkWorkspaceActions.reviewSafetyMatch,
	dismissProviderChange:
		catalogReviewWorkWorkspaceActions.dismissProviderChange,
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
					"Explain why the stored catalog value is better supported before resolving the conflict.",
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
				"The stored catalog value remains unchanged and this conflict is resolved. API readiness was recalculated.",
		};
	},
};
