import {
	readBlendCalcAPIPublicationReviewQueue,
	resolveBlendCalcAPIPublicationConcern,
} from "$lib/server/blendCalcAPI/blendCalcAPIPublicationConcerns.server";
import { throwAppError } from "$lib/server/errors/appError.server";
import { requireModeratorApiAccess } from "$lib/server/moderation/moderationAccess.server";
import { readLimitedJson } from "$lib/server/security/requestBody.server";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const MAXIMUM_REQUEST_BYTES = 16 * 1024;
const RESOLUTION_STATUSES = ["resolved", "dismissed"] as const;
const RESOLUTION_ACTIONS = [
	"product-correction",
	"image-correction",
	"source-policy-correction",
	"publication-hold",
	"no-change",
] as const;

const isMember = <Value extends string>(
	values: readonly Value[],
	value: unknown,
): value is Value =>
	typeof value === "string" && values.includes(value as Value);

export const GET: RequestHandler = async ({ locals }) => {
	await requireModeratorApiAccess(locals);
	try {
		return json(
			{ data: await readBlendCalcAPIPublicationReviewQueue() },
			{ headers: { "cache-control": "private, no-store" } },
		);
	} catch (error) {
		console.error("[api publication concern] Unable to read review queue", {
			error: error instanceof Error ? error.message : typeof error,
		});
		return throwAppError(503, "MODERATION_DATA_UNAVAILABLE");
	}
};

export const PATCH: RequestHandler = async ({ locals, request }) => {
	const { user } = await requireModeratorApiAccess(locals);
	const payload = await readLimitedJson(request, MAXIMUM_REQUEST_BYTES);
	if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
		throwAppError(400, "INVALID_REQUEST");
	}
	const body = payload as Record<string, unknown>;
	if (
		typeof body.concernId !== "string" ||
		!isMember(RESOLUTION_STATUSES, body.status) ||
		!isMember(RESOLUTION_ACTIONS, body.resolutionAction) ||
		typeof body.resolutionNote !== "string" ||
		(body.status === "dismissed" && body.resolutionAction !== "no-change")
	) {
		throwAppError(400, "INVALID_REQUEST");
	}
	const concernId = body.concernId as string;
	const status = body.status as (typeof RESOLUTION_STATUSES)[number];
	const resolutionAction =
		body.resolutionAction as (typeof RESOLUTION_ACTIONS)[number];
	const resolutionNote = body.resolutionNote as string;
	try {
		const resolved = await resolveBlendCalcAPIPublicationConcern({
			concernId,
			status,
			resolutionAction,
			resolutionNote,
			actorUserId: user.id,
		});
		if (!resolved) throwAppError(404, "RESOURCE_NOT_FOUND");
		return json(
			{ data: { resolved: true } },
			{ headers: { "cache-control": "private, no-store" } },
		);
	} catch (error) {
		if (typeof error === "object" && error && "status" in error) throw error;
		console.error("[api publication concern] Unable to resolve report", {
			error: error instanceof Error ? error.message : typeof error,
		});
		return throwAppError(503, "MODERATION_DATA_UNAVAILABLE");
	}
};
