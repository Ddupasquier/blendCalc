import { randomUUID } from "node:crypto";
import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import {
	getAvatarExtension,
	isProfileAvatarType,
	matchesAvatarFileSignature,
} from "$lib/utils/profile/profileValidation";

export const PRODUCT_EVIDENCE_BUCKET = "product-submission-evidence";
export const PRODUCT_EVIDENCE_ROLES = ["front", "nutrition", "barcode"] as const;
export const PRODUCT_EVIDENCE_MAX_BYTES = 8 * 1024 * 1024;

export type ProductEvidenceRole = (typeof PRODUCT_EVIDENCE_ROLES)[number];
export type ProductEvidencePaths = Partial<Record<ProductEvidenceRole, string>>;
export type ProductEvidenceFiles = Partial<Record<ProductEvidenceRole, File>>;

export const hasCompleteProductEvidence = (paths: ProductEvidencePaths) =>
	PRODUCT_EVIDENCE_ROLES.every((role) => Boolean(paths[role]));

const validateEvidenceFile = async (file: File, role: ProductEvidenceRole) => {
	if (!file.size) throw new Error(`Add the ${role} photo.`);
	if (file.size > PRODUCT_EVIDENCE_MAX_BYTES) {
		throw new Error("Each product photo must be 8MB or smaller.");
	}
	if (!isProfileAvatarType(file.type)) {
		throw new Error("Product photos must be JPEG, PNG, or WebP images.");
	}
	const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
	if (!matchesAvatarFileSignature(bytes, file.type)) {
		throw new Error("A product photo does not match its file type.");
	}
	return file.type;
};

export const uploadProductEvidence = async (
	userId: string,
	files: ProductEvidenceFiles,
): Promise<ProductEvidencePaths> => {
	const entries = PRODUCT_EVIDENCE_ROLES.flatMap((role) => {
		const file = files[role];
		return file ? [[role, file] as const] : [];
	});
	if (entries.length === 0) return {};

	const admin = getSupabaseAdminClient();
	const uploadId = randomUUID();
	const paths: ProductEvidencePaths = {};

	try {
		for (const [role, file] of entries) {
			const imageType = await validateEvidenceFile(file, role);
			const path = `${userId}/${uploadId}/${role}.${getAvatarExtension(imageType)}`;
			const { error } = await admin.storage
				.from(PRODUCT_EVIDENCE_BUCKET)
				.upload(path, file, { contentType: file.type, upsert: false });
			if (error) throw error;
			paths[role] = path;
		}
		return paths;
	} catch (error) {
		await deleteProductEvidence(paths);
		throw error;
	}
};

export const deleteProductEvidence = async (paths: ProductEvidencePaths) => {
	const values = Object.values(paths).filter((path): path is string => Boolean(path));
	if (values.length === 0) return;
	await getSupabaseAdminClient().storage
		.from(PRODUCT_EVIDENCE_BUCKET)
		.remove(values);
};

export const createProductEvidenceSignedUrls = async (
	paths: ProductEvidencePaths,
) => {
	const entries = Object.entries(paths).filter(
		(entry): entry is [ProductEvidenceRole, string] => Boolean(entry[1]),
	);
	if (entries.length === 0) return {};
	const { data, error } = await getSupabaseAdminClient().storage
		.from(PRODUCT_EVIDENCE_BUCKET)
		.createSignedUrls(entries.map(([, path]) => path), 10 * 60);
	if (error) throw error;

	return Object.fromEntries(
		entries.map(([role, path]) => [
			role,
			data?.find((item) => item.path === path)?.signedUrl ?? null,
		]),
	) as Partial<Record<ProductEvidenceRole, string | null>>;
};
