import { writeTutorialChoice } from "$lib/utils/tutorial/tutorial";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ locals, request }) => {
	const user = await locals.getVerifiedUser();
	if (!user) {
		return json({ error: "Authentication is required." }, { status: 401 });
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: "Request body must be valid JSON." }, { status: 400 });
	}

	const choice =
		typeof body === "object" && body !== null && "choice" in body
			? (body as { choice?: unknown }).choice
			: null;
	if (choice !== "complete") {
		return json({ error: "Unsupported tutorial choice." }, { status: 400 });
	}

	const saved = await writeTutorialChoice(
		locals.supabase,
		user.id,
		choice,
	);
	return saved
		? json({ saved: true })
		: json({ error: "Tutorial preference could not be saved." }, { status: 500 });
};
