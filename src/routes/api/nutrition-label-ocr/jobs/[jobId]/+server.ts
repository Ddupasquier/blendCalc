import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { appIssueJson } from "$lib/server/errors/appError.server";
import {
	cancelNutritionLabelOcrJob,
	readNutritionLabelOcrJob,
} from "$lib/server/ocr/nutritionLabelOcrJobs.server";

const isUuid = (value: string) =>
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
		value,
	);

export const GET: RequestHandler = async ({ locals, params }) => {
	const user = await locals.getVerifiedUser();
	if (!user) return appIssueJson(401, "AUTH_REQUIRED");
	if (!isUuid(params.jobId)) return appIssueJson(400, "INVALID_REQUEST");

	try {
		const job = await readNutritionLabelOcrJob({
			jobId: params.jobId,
			userId: user.id,
		});
		return job ? json({ job }) : appIssueJson(404, "RESOURCE_NOT_FOUND");
	} catch {
		return appIssueJson(503, "SERVICE_UNAVAILABLE");
	}
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	const user = await locals.getVerifiedUser();
	if (!user) return appIssueJson(401, "AUTH_REQUIRED");
	if (!isUuid(params.jobId)) return appIssueJson(400, "INVALID_REQUEST");

	try {
		const cancelled = await cancelNutritionLabelOcrJob({
			jobId: params.jobId,
			userId: user.id,
		});
		return cancelled
			? new Response(null, { status: 204 })
			: appIssueJson(404, "RESOURCE_NOT_FOUND");
	} catch {
		return appIssueJson(503, "SERVICE_UNAVAILABLE");
	}
};
