import { lookupBarcodeProductDraft } from "$lib/server/products/barcodeProduct.server";
import {
	requireAppValue,
	throwAppError,
} from "$lib/server/errors/appError.server";
import { normalizeBarcode } from "$lib/utils/barcode/barcode";
import { productNamesDiffer } from "$lib/utils/products/productIdentity";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ locals, params, request }) => {
	const user = await locals.getVerifiedUser();
	if (!user) throwAppError(401, "AUTH_REQUIRED");

	const barcode = requireAppValue(
		normalizeBarcode(params.barcode),
		400,
		"INVALID_BARCODE",
	);

	const body = await request.json().catch(() => null) as {
		productName?: unknown;
	} | null;
	const productName = typeof body?.productName === "string"
		? body.productName.trim()
		: "";
	if (!productName) throwAppError(400, "PRODUCT_NAME_REQUIRED");

	const draft = await lookupBarcodeProductDraft(locals.supabase, barcode);
	if (!draft) {
		return json({ status: "not-found", barcode });
	}

	if (productNamesDiffer(productName, draft.name)) {
		return json({
			status: "name-mismatch",
			barcode,
			draft,
			issue: {
				code: "PRODUCT_NAME_CONFLICT",
				params: { productName: draft.name },
			},
		});
	}

	return json({ status: "matched", barcode, draft });
};
