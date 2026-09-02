import {
	requireAppValue,
	throwAppError,
} from "$lib/server/errors/appError.server";
import { readCatalogIntakeStatus } from "$lib/server/products/catalogIntakeStatus.server";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals, params }) => {
	const user = requireAppValue(
		await locals.getVerifiedUser(),
		401,
		"AUTH_REQUIRED",
	);

	let status;
	try {
		status = await readCatalogIntakeStatus(locals.supabase, {
			submissionId: params.submissionId,
			userId: user.id,
		});
	} catch (statusError) {
		console.error(
			"[catalog intake] Submission status read failed",
			statusError,
		);
		throwAppError(503, "SERVICE_UNAVAILABLE");
	}

	return json(
		{
			data: requireAppValue(status, 404, "RESOURCE_NOT_FOUND"),
		},
		{
			headers: {
				"cache-control": "private, no-store",
			},
		},
	);
};
