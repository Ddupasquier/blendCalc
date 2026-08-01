import { randomUUID } from "node:crypto";
import {
	normalizePrivateImageEvidence,
	PRIVATE_PRODUCT_EVIDENCE_BUCKET,
} from "$lib/server/uploads/privateImageEvidence.server";
import { getSupabaseAdminClient } from "$lib/supabase/admin.server";

export const FOOD_COMPATIBILITY_EVIDENCE_MAX_BYTES = 8 * 1024 * 1024;

export type FoodCompatibilityEvidenceUpload = {
	path: string;
	sha256: string;
};

export const uploadFoodCompatibilityEvidence = async (
	userId: string,
	file: File,
): Promise<FoodCompatibilityEvidenceUpload> => {
	const image = await normalizePrivateImageEvidence(
		file,
		FOOD_COMPATIBILITY_EVIDENCE_MAX_BYTES,
	);
	const path = `${userId}/${randomUUID()}/compatibility-label.${image.extension}`;
	const { error } = await getSupabaseAdminClient().storage
		.from(PRIVATE_PRODUCT_EVIDENCE_BUCKET)
		.upload(path, image.bytes, {
			contentType: image.contentType,
			upsert: false,
		});
	if (error) throw error;

	return { path, sha256: image.sha256 };
};

export const deleteFoodCompatibilityEvidence = async (
	evidence: FoodCompatibilityEvidenceUpload | null,
) => {
	if (!evidence) return;
	await getSupabaseAdminClient().storage
		.from(PRIVATE_PRODUCT_EVIDENCE_BUCKET)
		.remove([evidence.path]);
};

export const createFoodCompatibilityEvidenceSignedUrl = async (
	path: string | null,
) => {
	if (!path) return null;
	const { data, error } = await getSupabaseAdminClient().storage
		.from(PRIVATE_PRODUCT_EVIDENCE_BUCKET)
		.createSignedUrl(path, 10 * 60);
	if (error) throw error;
	return data.signedUrl;
};
