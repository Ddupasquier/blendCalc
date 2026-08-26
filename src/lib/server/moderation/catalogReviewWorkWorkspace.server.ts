import { fail, type RequestEvent } from "@sveltejs/kit";
import { readCatalogReviewWork } from "$lib/server/moderation/catalogReviewWork.server";
import { requireModeratorPermission } from "$lib/server/moderation/moderationAccess.server";
import { readLimitedFormData } from "$lib/server/security/requestBody.server";

const CATALOG_REVIEW_FORM_MAX_BYTES = 32 * 1024;
const CATALOG_REVIEW_WORK_ROUTE =
	"/profile/privileged-tools/catalog-review-work";

type CatalogReviewWorkLoadEvent = Pick<RequestEvent, "locals">;
type CatalogReviewWorkAction = (
	event: Pick<RequestEvent, "locals" | "request">,
) => Promise<unknown>;

export const loadCatalogReviewWorkWorkspace = async (
	{ locals }: CatalogReviewWorkLoadEvent,
	returnPath = CATALOG_REVIEW_WORK_ROUTE,
) => {
	const { role } = await requireModeratorPermission(
		locals,
		"moderation.catalog.review",
		returnPath,
	);

	return {
		viewerRole: role,
		reviewWork: await readCatalogReviewWork(locals.supabase),
	};
};

export const catalogReviewWorkWorkspaceActions = {
	reviewSafetyMatch: async ({ locals, request }) => {
		await requireModeratorPermission(
			locals,
			"moderation.catalog.review",
			CATALOG_REVIEW_WORK_ROUTE,
		);
		const formData = await readLimitedFormData(
			request,
			CATALOG_REVIEW_FORM_MAX_BYTES,
		);
		const matchId = String(formData.get("matchId") ?? "");
		const outcome = String(formData.get("outcome") ?? "");
		const reviewNote = String(formData.get("reviewNote") ?? "").trim();
		if (
			!matchId ||
			!["confirmed", "dismissed"].includes(outcome) ||
			!reviewNote
		) {
			return fail(400, {
				catalogReviewError:
					"Choose an outcome and explain the evidence behind it.",
			});
		}
		const { error } = await locals.supabase.rpc(
			"review_official_food_safety_alert_match",
			{
				p_match_id: matchId,
				p_outcome: outcome,
				p_review_note: reviewNote,
			},
		);
		if (error) {
			return fail(500, {
				catalogReviewError:
					"That recall match could not be reviewed right now.",
			});
		}
		return {
			catalogReviewSuccess:
				outcome === "confirmed"
					? "The recall match is confirmed."
					: "The recall match was dismissed.",
		};
	},
	dismissProviderChange: async ({ locals, request }) => {
		await requireModeratorPermission(
			locals,
			"moderation.catalog.review",
			CATALOG_REVIEW_WORK_ROUTE,
		);
		const formData = await readLimitedFormData(
			request,
			CATALOG_REVIEW_FORM_MAX_BYTES,
		);
		const reviewId = String(formData.get("reviewId") ?? "");
		const reviewNote = String(formData.get("reviewNote") ?? "").trim();
		if (!reviewId || !reviewNote) {
			return fail(400, {
				catalogReviewError:
					"Explain why the current catalog record should stay unchanged.",
			});
		}
		const { error } = await locals.supabase.rpc(
			"review_catalog_provider_change",
			{
				p_review_id: reviewId,
				p_outcome: "rejected",
				p_review_note: reviewNote,
			},
		);
		if (error) {
			return fail(500, {
				catalogReviewError:
					"That provider change could not be reviewed right now.",
			});
		}
		return {
			catalogReviewSuccess: "The current catalog revision remains active.",
		};
	},
} satisfies Record<string, CatalogReviewWorkAction>;

export type CatalogReviewWorkWorkspaceData = Awaited<
	ReturnType<typeof loadCatalogReviewWorkWorkspace>
>;
