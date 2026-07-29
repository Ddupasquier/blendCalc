import { writeTutorialChoice } from "$lib/utils/tutorial/tutorial";
import { appIssueJson } from "$lib/server/errors/appError.server";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ locals, request }) => {
	const user = await locals.getVerifiedUser();
	if (!user) {
		return appIssueJson(401, "AUTH_REQUIRED");
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return appIssueJson(400, "INVALID_REQUEST");
	}

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
