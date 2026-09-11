import { fail, redirect } from "@sveltejs/kit";
import { readAppRolePermissions } from "$lib/server/moderation/appRolePermissions.server";
import { readFoodWarningFollowUpCase } from "$lib/server/moderation/foodWarningFollowUp.server";
import { requireModeratorPermission } from "$lib/server/moderation/moderationAccess.server";
import { readLimitedFormData } from "$lib/server/security/requestBody.server";
import { throwAppError } from "$lib/server/errors/appError.server";
import { hasAppPermission } from "$lib/utils/moderation/profilePrivilegedTools";
import type { Actions, PageServerLoad } from "./$types";

const QUEUE_PATH = "/profile/privileged-tools/food-warning-reports";

export const load: PageServerLoad = async ({ locals, params }) => {
	const { role } = await requireModeratorPermission(
		locals,
		"moderation.warnings.review",
		QUEUE_PATH,
	);
	const reviewCase = await readFoodWarningFollowUpCase(params.caseId);
	if (!reviewCase) return throwAppError(404, "MODERATION_TARGET_NOT_FOUND");
	const permissions = await readAppRolePermissions(role);
	const isTerminal = ["resolved", "dismissed"].includes(reviewCase.status);
	return {
		reviewCase,
		canResolve:
			!isTerminal &&
			(reviewCase.responsibleGroup !== "data_operations" ||
				hasAppPermission(permissions, "data_operations.catalog_health.repair")),
	};
};

export const actions: Actions = {
	resolveFollowUp: async ({ locals, params, request }) => {
		await requireModeratorPermission(
			locals,
			"moderation.warnings.review",
			QUEUE_PATH,
		);
		const formData = await readLimitedFormData(request, 32 * 1024);
		const caseId = String(formData.get("caseId") ?? "");
		const outcome = String(formData.get("outcome") ?? "");
		const resolutionNote = String(formData.get("resolutionNote") ?? "").trim();
		if (
			!caseId ||
			caseId !== params.caseId ||
			!["resolved", "dismissed", "deferred"].includes(outcome) ||
			!resolutionNote
		) {
			return fail(400, {
				followUpError: "Choose an outcome and record the evidence behind it.",
			});
		}
		const { data, error } = await locals.supabase.rpc(
			"resolve_food_warning_policy_review_case",
			{
				p_case_id: caseId,
				p_outcome: outcome,
				p_resolution_note: resolutionNote,
			},
		);
		if (error) {
			return fail(error.code === "42501" ? 403 : 500, {
				followUpError:
					error.code === "42501"
						? "Your current role cannot finish this follow-up."
						: "That follow-up could not be saved right now.",
			});
		}
		if (
			!data ||
			typeof data !== "object" ||
			Array.isArray(data) ||
			data.reviewed !== true
		) {
			return fail(409, {
				followUpError:
					"That follow-up was already completed. Refresh the queue.",
			});
		}
		redirect(303, QUEUE_PATH);
	},
};
