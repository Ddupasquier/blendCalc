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
import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals, url }) => {
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
		const result = await searchBlendCalcAPIV1Products(
			getSupabaseAdminClient(),
			request,
		);
		return blendCalcAPIV1Success(result.products, result.pagination);
	} catch (error) {
		console.error("blendCalcAPI v1 product search failed.", error);
		return blendCalcAPIV1Error("catalog_unavailable");
	}
};
