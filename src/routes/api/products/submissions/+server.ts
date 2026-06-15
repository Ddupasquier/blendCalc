import { submitProductForCatalog } from "$lib/server/products/catalog.server";
import type { FdcFood } from "$lib/utils/food/types";
import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ locals, request }) => {
	const { user } = await locals.safeGetSession();
	if (!user) throw error(401, "Sign in to share products.");

	const body = await request.json() as {
		food?: FdcFood;
		consentToShare?: boolean;
	};
	if (!body.food || body.consentToShare !== true) {
		throw error(400, "Product data and sharing consent are required.");
	}

	try {
		return json(await submitProductForCatalog(user.id, body.food), { status: 201 });
	} catch (submissionError) {
		const message = submissionError instanceof Error
			? submissionError.message
			: "The product could not be submitted.";
		throw error(400, message);
	}
};
