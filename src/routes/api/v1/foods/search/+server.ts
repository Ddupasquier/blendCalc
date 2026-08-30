import {
	BlendCalcAPIV1RequestError,
	readBlendCalcAPIV1SearchRequest,
} from "$lib/blendCalcAPI/v1/blendCalcAPIRequest";
import { searchBlendCalcAPIV1Products } from "$lib/server/blendCalcAPI/v1/blendCalcAPICatalog.server";
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
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({
	locals,
	request: httpRequest,
	url,
}) => {
	if (!(await hasBlendCalcAPIV1CatalogReadAccess(locals))) {
		return blendCalcAPIV1Error("authentication_required");
	}
	let request: ReturnType<typeof readBlendCalcAPIV1SearchRequest>;
	try {
		request = readBlendCalcAPIV1SearchRequest(url);
	} catch (error) {
		if (error instanceof BlendCalcAPIV1RequestError) {
			return blendCalcAPIV1Error(error.code, error.message);
		}
		throw error;
	}
	try {
		const result = await runBlendCalcAPIV1RequestWithinDeadline(
			(databaseAbortSignal) =>
				searchBlendCalcAPIV1Products(getSupabaseAdminClient(), request, {
					databaseAbortSignal,
				}),
		);
		return blendCalcAPIV1Success(result.products, result.pagination, {
			ifNoneMatch: httpRequest?.headers.get("if-none-match"),
		});
	} catch (error) {
		if (isBlendCalcAPIV1RequestTimeoutError(error)) {
			return blendCalcAPIV1Error("service_unavailable");
		}
		console.error("blendCalcAPI v1 product search failed.", error);
		return blendCalcAPIV1Error("catalog_unavailable");
	}
};
