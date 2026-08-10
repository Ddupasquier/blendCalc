import { writeTutorialChoice } from "$lib/utils/tutorial/tutorial";
import { appIssueJson } from "$lib/server/errors/appError.server";
import { readLimitedJson } from "$lib/server/security/requestBody.server";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const TUTORIAL_REQUEST_MAX_BYTES = 8 * 1024;

export const POST: RequestHandler = async ({ locals, request }) => {
	const user = await locals.getVerifiedUser();
	if (!user) {
		return appIssueJson(401, "AUTH_REQUIRED");
	}

	const body = await readLimitedJson(request, TUTORIAL_REQUEST_MAX_BYTES);

	const choice =
		typeof body === "object" && body !== null && "choice" in body
			? (body as { choice?: unknown }).choice
			: null;
	if (choice !== "complete" && choice !== "later") {
		return appIssueJson(400, "TUTORIAL_CHOICE_INVALID");
	}

	const saved = await writeTutorialChoice(
		locals.supabase,
		user.id,
		choice,
	);
	return saved
		? json({ saved: true })
		: appIssueJson(500, "TUTORIAL_SAVE_FAILED");
};
