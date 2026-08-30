import {
	BlendCalcAPIV1RequestError,
	readBlendCalcAPIV1RevisionHistoryRequest,
} from "$lib/blendCalcAPI/v1/blendCalcAPIRequest";
import { readBlendCalcAPIV1ProductRevisionHistory } from "$lib/server/blendCalcAPI/v1/blendCalcAPICatalog.server";
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
import { normalizeBarcode } from "$lib/utils/barcode/barcode";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({
	locals,
	params,
	request: httpRequest,
	url,
}) => {
	if (!(await hasBlendCalcAPIV1CatalogReadAccess(locals))) {
		return blendCalcAPIV1Error("authentication_required");
	}
	const barcode = normalizeBarcode(params.barcode);
	if (!barcode) {
		return blendCalcAPIV1Error("invalid_barcode");
	}
	let request: ReturnType<typeof readBlendCalcAPIV1RevisionHistoryRequest>;
	try {
		request = readBlendCalcAPIV1RevisionHistoryRequest(url);
	} catch (error) {
		if (error instanceof BlendCalcAPIV1RequestError) {
			return blendCalcAPIV1Error(error.code, error.message);
		}
		throw error;
	}
	try {
		const result = await runBlendCalcAPIV1RequestWithinDeadline(
			(databaseAbortSignal) =>
				readBlendCalcAPIV1ProductRevisionHistory(
					getSupabaseAdminClient(),
					barcode,
					request,
					{ databaseAbortSignal },
				),
		);
		if (!result) {
			return blendCalcAPIV1Error("product_not_found");
		}
		return blendCalcAPIV1Success(result.revisions, result.pagination, {
			ifNoneMatch: httpRequest?.headers.get("if-none-match"),
		});
	} catch (error) {
		if (isBlendCalcAPIV1RequestTimeoutError(error)) {
			return blendCalcAPIV1Error("service_unavailable");
		}
		console.error("blendCalcAPI v1 revision-history read failed.", error);
		return blendCalcAPIV1Error("catalog_unavailable");
	}
};
