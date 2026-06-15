import { submitProductForCatalog } from "$lib/server/products/catalog.server";
import {
	deleteProductEvidence,
	uploadProductEvidence,
	type ProductEvidenceFiles,
	type ProductEvidencePaths,
} from "$lib/server/products/productEvidence.server";
import type { FdcFood } from "$lib/utils/food/types";
import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ locals, request }) => {
	const { user } = await locals.safeGetSession();
	if (!user) throw error(401, "Sign in to share products.");

	const formData = await request.formData();
	const foodValue = formData.get("food");
	const consentToShare = formData.get("consentToShare") === "true";
	let food: FdcFood | null = null;
	try {
		food = foodValue ? JSON.parse(String(foodValue)) as FdcFood : null;
	} catch {
		throw error(400, "Product data is invalid.");
	}
	if (!food || !consentToShare) {
		throw error(400, "Product data and sharing consent are required.");
	}

	const evidenceFiles = Object.fromEntries(
		(["front", "nutrition", "barcode"] as const).flatMap((role) => {
			const value = formData.get(`${role}Photo`);
			return value instanceof File && value.size > 0 ? [[role, value]] : [];
		}),
	) as ProductEvidenceFiles;
	let evidencePaths: ProductEvidencePaths = {};

	try {
		evidencePaths = await uploadProductEvidence(user.id, evidenceFiles);
		const result = await submitProductForCatalog(user.id, food, evidencePaths);
		if (result.evidenceAccepted !== true) {
			await deleteProductEvidence(evidencePaths);
		}
		return json(result, { status: 201 });
	} catch (submissionError) {
		await deleteProductEvidence(evidencePaths);
		const message = submissionError instanceof Error
			? submissionError.message
			: "The product could not be submitted.";
		throw error(400, message);
	}
};
