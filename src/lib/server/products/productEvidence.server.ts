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

	const validatedEntries = await Promise.all(
		entries.map(async ([role, file]) => ({
			role,
			file,
			imageType: await validateEvidenceFile(file, role),
		})),
	);
	const uploadResults = await Promise.all(
		validatedEntries.map(async ({ role, file, imageType }) => {
			const path = `${userId}/${uploadId}/${role}.${getAvatarExtension(imageType)}`;
			try {
				const { error } = await admin.storage
					.from(PRODUCT_EVIDENCE_BUCKET)
					.upload(path, file, { contentType: file.type, upsert: false });
				return { role, path, error };
			} catch (error) {
				return { role, path, error };
			}
		}),
	);

	for (const result of uploadResults) {
		if (!result.error) paths[result.role] = result.path;
	}
	const failedUpload = uploadResults.find((result) => result.error);
	if (failedUpload) {
		await deleteProductEvidence(paths);
		throw failedUpload.error;
	}
	return paths;
};

export const deleteProductEvidence = async (paths: ProductEvidencePaths) => {
	const values = Object.values(paths).filter((path): path is string => Boolean(path));
	if (values.length === 0) return;
	await getSupabaseAdminClient().storage
		.from(PRODUCT_EVIDENCE_BUCKET)
		.remove(values);
};

export const createProductEvidenceSignedUrlBatches = async (
	pathGroups: ProductEvidencePaths[],
): Promise<Array<Partial<Record<ProductEvidenceRole, string | null>>>> => {
	const uniquePaths = [
		...new Set(
			pathGroups.flatMap((paths) =>
				Object.values(paths).filter((path): path is string => Boolean(path))
			),
		),
	];
	if (uniquePaths.length === 0) {
		return pathGroups.map(() =>
			({}) as Partial<Record<ProductEvidenceRole, string | null>>
		);
	}

	const { data, error } = await getSupabaseAdminClient().storage
		.from(PRODUCT_EVIDENCE_BUCKET)
		.createSignedUrls(uniquePaths, 10 * 60);
	if (error) throw error;
	const signedUrlByPath = new Map(
		(data ?? []).map((item) => [item.path, item.signedUrl ?? null]),
	);

	return pathGroups.map((paths) =>
		Object.fromEntries(
			Object.entries(paths).flatMap(([role, path]) =>
				path
					? [[role, signedUrlByPath.get(path) ?? null]]
					: [],
			),
		) as Partial<Record<ProductEvidenceRole, string | null>>
	);
};
