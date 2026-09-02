import {
	BlendCalcAPIV1RequestError,
	readBlendCalcAPIV1CategoryRequest,
} from "$lib/blendCalcAPI/v1/blendCalcAPIRequest";
import { readBlendCalcAPIV1Categories } from "$lib/server/blendCalcAPI/v1/blendCalcAPIReadModel.server";
import { hasBlendCalcAPIV1CatalogReadAccess } from "$lib/server/blendCalcAPI/v1/blendCalcAPIAccessPolicy.server";
import {
	blendCalcAPIV1Error,
	blendCalcAPIV1Success,
} from "$lib/server/blendCalcAPI/v1/blendCalcAPIHttp.server";
import {
	isBlendCalcAPIV1RequestTimeoutError,
	runBlendCalcAPIV1RequestWithinDeadline,
} from "$lib/server/blendCalcAPI/v1/blendCalcAPIRequestBoundary.server";
import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import { observeBlendCalcAPIDatabaseRead } from "$lib/server/blendCalcAPI/operations/blendCalcAPIOperations.server";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({
	locals,
	request: httpRequest,
	url,
}) => {
	if (!(await hasBlendCalcAPIV1CatalogReadAccess(locals))) {
		return blendCalcAPIV1Error("authentication_required");
	}
	let request: ReturnType<typeof readBlendCalcAPIV1CategoryRequest>;
	try {
		request = readBlendCalcAPIV1CategoryRequest(url);
	} catch (error) {
		if (error instanceof BlendCalcAPIV1RequestError) {
			return blendCalcAPIV1Error(error.code, error.message);
		}
		throw error;
	}
	try {
		const result = await observeBlendCalcAPIDatabaseRead(
			locals,
			() =>
				runBlendCalcAPIV1RequestWithinDeadline((databaseAbortSignal) =>
					readBlendCalcAPIV1Categories(getSupabaseAdminClient(), request, {
						databaseAbortSignal,
					}),
				),
			(value) => value.categories.length,
		);
		return blendCalcAPIV1Success(result.categories, result.pagination, {
			ifNoneMatch: httpRequest?.headers.get("if-none-match"),
		});
	} catch (error) {
		if (isBlendCalcAPIV1RequestTimeoutError(error)) {
			return blendCalcAPIV1Error("service_unavailable");
		}
		console.error("blendCalcAPI v1 category read failed.", error);
		return blendCalcAPIV1Error("catalog_unavailable");
	}
};
