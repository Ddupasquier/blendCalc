import { env } from "$env/dynamic/private";
import { error, isHttpError } from "@sveltejs/kit";
import {
	fetchOfficialFoodSafetySource,
	isAuthorizedOfficialFoodSafetySourceRequest,
	type OfficialFoodSafetySource,
} from "$lib/server/food-safety/officialFoodSafetySourceProxy.server";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ request, url }) => {
	const providedSecret =
		request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
	if (
		!isAuthorizedOfficialFoodSafetySourceRequest(
			providedSecret,
			env.FDA_RECALL_PROXY_SECRET,
		)
	) {
		throw error(401, "Unauthorized");
	}

	try {
		const requestedSource = url.searchParams.get("source") ?? "fda";
		if (requestedSource !== "fda" && requestedSource !== "fsis") {
			throw error(400, "Invalid official food safety source");
		}
		const result = await fetchOfficialFoodSafetySource({
			source: requestedSource as OfficialFoodSafetySource,
			sourcePath: url.searchParams.get("sourcePath"),
			ifNoneMatch: request.headers.get("if-none-match"),
			ifModifiedSince: request.headers.get("if-modified-since"),
		});
		if (result.status === "invalid_path") {
			throw error(400, "Invalid official food safety source path");
		}

		const headers = new Headers({
			"cache-control": "private, no-store",
		});
		if (result.etag) headers.set("etag", result.etag);
		if (result.lastModified) {
			headers.set("last-modified", result.lastModified);
		}
		if (result.status === "not_modified") {
			return new Response(null, { status: 304, headers });
		}
		headers.set("content-type", result.contentType);
		return new Response(result.body, { status: 200, headers });
	} catch (sourceError) {
		if (isHttpError(sourceError)) throw sourceError;
		console.error("[food-safety] Official recall source relay failed", {
			errorType:
				sourceError instanceof Error ? sourceError.name : typeof sourceError,
		});
		throw error(503, "Official recall information is temporarily unavailable.");
	}
};
