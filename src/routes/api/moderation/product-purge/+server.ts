import { requireModeratorApiPermission } from "$lib/server/moderation/moderationAccess.server";
import { PRODUCT_EVIDENCE_BUCKET } from "$lib/server/products/productEvidence.server";
import { readLimitedJson } from "$lib/server/security/requestBody.server";
import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import type {
	CatalogProductPurgePreview,
	CatalogProductPurgeResult,
} from "$lib/utils/moderation/catalogProductPurge";
import { normalizeBarcode } from "$lib/utils/barcode/barcode";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

type PurgeRequest = {
	action?: unknown;
	barcode?: unknown;
	confirmationBarcode?: unknown;
	reason?: unknown;
};

const PURGE_REQUEST_MAX_BYTES = 8 * 1024;

const readRequest = async (request: Request) => {
	const payload = await readLimitedJson(request, PURGE_REQUEST_MAX_BYTES);
	const body =
		payload && typeof payload === "object" && !Array.isArray(payload)
			? (payload as PurgeRequest)
			: {};
	const action = body.action === "purge" ? "purge" : "preview";
	const rawBarcode = typeof body.barcode === "string" ? body.barcode : "";
	const barcode = normalizeBarcode(rawBarcode);
	if (!barcode) {
		return {
			error: "Enter a valid UPC / GTIN, including its check digit.",
		} as const;
	}
	return {
		action,
		barcode,
		confirmationBarcode:
			typeof body.confirmationBarcode === "string"
				? normalizeBarcode(body.confirmationBarcode)
				: null,
		reason: typeof body.reason === "string" ? body.reason.trim() : "",
	} as const;
};

const getStoragePaths = async (barcode: string) => {
	const admin = getSupabaseAdminClient();
	const { data, error } = await admin.rpc(
		"service_catalog_product_purge_storage_paths",
		{ p_barcode: barcode },
	);
	if (error) throw error;
	return data ?? [];
};

export const POST: RequestHandler = async ({ locals, request }) => {
	await requireModeratorApiPermission(
		locals,
		"data_operations.catalog_health.repair",
	);
	const input = await readRequest(request);
	if ("error" in input) return json({ message: input.error }, { status: 400 });

	if (input.action === "preview") {
		const { data, error } = await locals.supabase.rpc(
			"preview_catalog_product_purge",
			{ p_barcode: input.barcode },
		);
		if (error) throw error;
		return json({
			action: "preview",
			preview: data as CatalogProductPurgePreview,
		});
	}

	if (input.confirmationBarcode !== input.barcode) {
		return json(
			{ message: "Type the exact UPC / GTIN shown in the preview." },
			{ status: 400 },
		);
	}
	if (input.reason.length < 10 || input.reason.length > 1000) {
		return json(
			{ message: "Enter a deletion reason between 10 and 1000 characters." },
			{ status: 400 },
		);
	}

	const storagePaths = await getStoragePaths(input.barcode);
	const { data, error } = await locals.supabase.rpc(
		"purge_catalog_product_by_barcode",
		{
			p_barcode: input.barcode,
			p_confirmation_barcode: input.confirmationBarcode,
			p_reason: input.reason,
		},
	);
	if (error) throw error;

	if (storagePaths.length > 0) {
		const { error: storageError } = await getSupabaseAdminClient()
			.storage.from(PRODUCT_EVIDENCE_BUCKET)
			.remove(storagePaths);
		if (storageError) {
			console.error(
				"[catalog product purge] Database purge completed, but Storage cleanup failed",
				storageError,
			);
			return json(
				{
					message:
						"The database records were deleted, but one or more private evidence files still need Storage cleanup. Do not run the purge again; use the purge ID from the server log.",
				},
				{ status: 500 },
			);
		}
	}

	return json({
		action: "purge",
		result: {
			...(data as Omit<CatalogProductPurgeResult, "storageObjectsDeleted">),
			storageObjectsDeleted: storagePaths.length,
		},
	});
};
