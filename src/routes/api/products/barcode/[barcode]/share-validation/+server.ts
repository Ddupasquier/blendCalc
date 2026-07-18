import { lookupBarcodeProductDraft } from "$lib/server/products/barcodeProduct.server";
import { normalizeBarcode } from "$lib/utils/barcode/barcode";
import { productNamesDiffer } from "$lib/utils/products/productIdentity";
import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ locals, params, request }) => {
	const { user } = await locals.safeGetSession();
	if (!user) throw error(401, "Sign in to verify products.");

	const barcode = normalizeBarcode(params.barcode);
	if (!barcode) throw error(400, "Invalid barcode.");

	const body = await request.json().catch(() => null) as {
		productName?: unknown;
	} | null;
	const productName = typeof body?.productName === "string"
		? body.productName.trim()
		: "";
	if (!productName) throw error(400, "A product name is required.");

	const draft = await lookupBarcodeProductDraft(locals.supabase, barcode);
	if (!draft) {
		return json({ status: "not-found", barcode });
	}

	if (productNamesDiffer(productName, draft.name)) {
		return json({
			status: "name-mismatch",
			barcode,
			draft,
			message:
				`This barcode belongs to “${draft.name}”. Use the verified information to share it, or keep your current entry private.`,
		});
	}

	return json({ status: "matched", barcode, draft });
};
