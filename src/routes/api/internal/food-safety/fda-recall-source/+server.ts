import { env } from "$env/dynamic/private";
import { error, isHttpError } from "@sveltejs/kit";
import {
	fetchFdaRecallSource,
	isAuthorizedFdaRecallSourceRequest,
} from "$lib/server/food-safety/fdaRecallSourceProxy.server";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ request, url }) => {
	const providedSecret =
		request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
	if (
		!isAuthorizedFdaRecallSourceRequest(
			providedSecret,
			env.FDA_RECALL_PROXY_SECRET,
		)
	) {
		throw error(401, "Unauthorized");
	}

	try {
		const result = await fetchFdaRecallSource({
			sourcePath: url.searchParams.get("sourcePath"),
			ifNoneMatch: request.headers.get("if-none-match"),
			ifModifiedSince: request.headers.get("if-modified-since"),
		});
		if (result.status === "invalid_path") {
			throw error(400, "Invalid FDA recall source path");
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
		console.error("[food-safety] FDA recall source relay failed", {
			errorType:
				sourceError instanceof Error ? sourceError.name : typeof sourceError,
		});
		throw error(503, "FDA recall information is temporarily unavailable.");
	}
};
