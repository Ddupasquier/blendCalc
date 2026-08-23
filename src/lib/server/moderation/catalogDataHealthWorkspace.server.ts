import { fail, type RequestEvent } from "@sveltejs/kit";
import {
	readCatalogMonitorModerationSummary,
	readModeratorDataHealth,
} from "$lib/server/moderation/catalogDataHealth.server";
import { requireModeratorPermission } from "$lib/server/moderation/moderationAccess.server";
import { readLimitedFormData } from "$lib/server/security/requestBody.server";

const DATA_HEALTH_REVIEW_FORM_MAX_BYTES = 32 * 1024;

type CatalogDataHealthLoadEvent = Pick<RequestEvent, "locals">;
type CatalogDataHealthAction = (
	event: Pick<RequestEvent, "locals" | "request">,
) => Promise<unknown>;

export const loadCatalogDataHealthWorkspace = async (
	{ locals }: CatalogDataHealthLoadEvent,
	returnPath = "/moderation/data-health",
) => {
	const { role } = await requireModeratorPermission(
		locals,
		"moderation.data_health.read",
		returnPath,
	);
	const [dashboard, catalogMonitor] = await Promise.all([
		readModeratorDataHealth(locals.supabase),
		readCatalogMonitorModerationSummary(locals.supabase),
	]);

	return {
		viewerRole: role,
		dashboard,
		catalogMonitor,
	};
};

export const catalogDataHealthWorkspaceActions = {
	reviewSafetyMatch: async ({ locals, request }) => {
		await requireModeratorPermission(
			locals,
			"moderation.catalog.review",
			"/profile/privileged-tools/catalog-data-health",
		);
		const formData = await readLimitedFormData(request, DATA_HEALTH_REVIEW_FORM_MAX_BYTES);
		const matchId = String(formData.get("matchId") ?? "");
		const outcome = String(formData.get("outcome") ?? "");
		const reviewNote = String(formData.get("reviewNote") ?? "").trim();
		if (!matchId || !["confirmed", "dismissed"].includes(outcome) || !reviewNote) {
			return fail(400, { monitorReviewError: "Choose an outcome and explain the evidence behind it." });
		}
		const { error } = await locals.supabase.rpc(
			"review_official_food_safety_alert_match",
			{
				p_match_id: matchId,
				p_outcome: outcome,
				p_review_note: reviewNote,
			},
		);
		if (error) return fail(500, { monitorReviewError: "That recall match could not be reviewed right now." });
		return { monitorReviewSuccess: outcome === "confirmed" ? "The recall match is confirmed." : "The recall match was dismissed." };
	},
	dismissProviderChange: async ({ locals, request }) => {
		await requireModeratorPermission(
			locals,
			"moderation.catalog.review",
			"/profile/privileged-tools/catalog-data-health",
		);
		const formData = await readLimitedFormData(request, DATA_HEALTH_REVIEW_FORM_MAX_BYTES);
		const reviewId = String(formData.get("reviewId") ?? "");
		const reviewNote = String(formData.get("reviewNote") ?? "").trim();
		if (!reviewId || !reviewNote) {
			return fail(400, { monitorReviewError: "Explain why the current catalog record should stay unchanged." });
		}
		const { error } = await locals.supabase.rpc("review_catalog_provider_change", {
			p_review_id: reviewId,
			p_outcome: "rejected",
			p_review_note: reviewNote,
		});
		if (error) return fail(500, { monitorReviewError: "That provider change could not be reviewed right now." });
		return { monitorReviewSuccess: "The current catalog revision remains active." };
	},
} satisfies Record<string, CatalogDataHealthAction>;

export type CatalogDataHealthWorkspaceData = Awaited<
	ReturnType<typeof loadCatalogDataHealthWorkspace>
>;
