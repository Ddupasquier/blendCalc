import { env } from "$env/dynamic/private";
import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import { readLimitedJson } from "$lib/server/security/requestBody.server";
import {
	rollbackBlendCalcAPIPublication,
	synchronizeBlendCalcAPIPublication,
} from "$lib/server/blendCalcAPI/publication/blendCalcAPIPublicationSync.server";
import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const MAXIMUM_ACTION_REQUEST_BYTES = 64;

const authorize = (request: Request) => {
	const secret = env.CRON_SECRET;
	if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
		throw error(401, "Unauthorized");
	}
};

const synchronize = async () => {
	try {
		const result = await synchronizeBlendCalcAPIPublication(
			getSupabaseAdminClient(),
		);
		return json({ synchronized: true, ...result });
	} catch (syncError) {
		console.error("[blendCalcAPI] publication synchronization failed", {
			errorType: syncError instanceof Error ? syncError.name : typeof syncError,
		});
		throw error(503, "Publication synchronization is temporarily unavailable.");
	}
};

export const GET: RequestHandler = async ({ request }) => {
	authorize(request);
	return synchronize();
};

export const POST: RequestHandler = async ({ request }) => {
	authorize(request);
	const body = (await readLimitedJson(
		request,
		MAXIMUM_ACTION_REQUEST_BYTES,
	)) as {
		action?: unknown;
	};
	if (body?.action !== "rollback") return synchronize();
	try {
		const result = await rollbackBlendCalcAPIPublication();
		return json({ synchronized: true, ...result });
	} catch (rollbackError) {
		console.error("[blendCalcAPI] publication rollback failed", {
			errorType:
				rollbackError instanceof Error
					? rollbackError.name
					: typeof rollbackError,
		});
		throw error(503, "Publication rollback is temporarily unavailable.");
	}
};
