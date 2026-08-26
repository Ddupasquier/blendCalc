import { createHash } from "node:crypto";
import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import { normalizeBarcode } from "$lib/utils/barcode/barcode";

export const BLENDCALC_API_PUBLICATION_REPORTER_TYPES = [
	"user",
	"provider",
	"brand",
	"rights-holder",
	"other",
] as const;

export const BLENDCALC_API_PUBLICATION_CONCERN_TYPES = [
	"product-correction",
	"rights-or-license",
	"attribution",
	"privacy",
	"source-retirement",
	"other",
] as const;

export const BLENDCALC_API_PUBLICATION_SUBJECT_TYPES = [
	"product",
	"image",
	"dataset",
	"source",
] as const;

export type BlendCalcAPIPublicationReporterType =
	(typeof BLENDCALC_API_PUBLICATION_REPORTER_TYPES)[number];
export type BlendCalcAPIPublicationConcernType =
	(typeof BLENDCALC_API_PUBLICATION_CONCERN_TYPES)[number];
export type BlendCalcAPIPublicationSubjectType =
	(typeof BLENDCALC_API_PUBLICATION_SUBJECT_TYPES)[number];

export type CreateBlendCalcAPIPublicationConcernInput = {
	reporterType: BlendCalcAPIPublicationReporterType;
	contactName?: string;
	contactEmail: string;
	reporterUserId?: string;
	concernType: BlendCalcAPIPublicationConcernType;
	subjectType: BlendCalcAPIPublicationSubjectType;
	subjectReference: string;
	details: string;
	evidenceUrls: string[];
};

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SOURCE_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const normalizeOptionalText = (
	value: string | undefined,
	maximumLength: number,
) => {
	const normalized = value?.trim().replace(/\s+/g, " ") ?? "";
	return normalized ? normalized.slice(0, maximumLength) : null;
};

const normalizeContactEmail = (value: string) => {
	const normalized = value.trim().toLocaleLowerCase();
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) &&
		normalized.length <= 320
		? normalized
		: null;
};

const normalizeEvidenceUrls = (values: string[]) => {
	const normalized = [
		...new Set(values.map((value) => value.trim()).filter(Boolean)),
	];
	if (normalized.length > 5) return null;
	return normalized.every((value) => {
		if (value.length > 2048) return false;
		try {
			return new URL(value).protocol === "https:";
		} catch {
			return false;
		}
	})
		? normalized
		: null;
};

const normalizeSubjectReference = (
	subjectType: BlendCalcAPIPublicationSubjectType,
	value: string,
) => {
	const normalized = value.trim();
	if (!normalized || normalized.length > 256) return null;
	if (subjectType === "product") return normalizeBarcode(normalized);
	if (subjectType === "image")
		return UUID_PATTERN.test(normalized) ? normalized : null;
	return SOURCE_KEY_PATTERN.test(normalized) ? normalized : null;
};

const findConcernSubject = async (
	subjectType: BlendCalcAPIPublicationSubjectType,
	subjectReference: string,
) => {
	const admin = getSupabaseAdminClient();
	if (subjectType === "product") {
		const { data, error } = await admin
			.from("shared_products")
			.select("id")
			.eq("barcode", subjectReference)
			.maybeSingle();
		if (error) throw error;
		return data ? { shared_product_id: data.id } : null;
	}
	if (subjectType === "image") {
		const { data, error } = await admin
			.from("food_image_assets")
			.select("id")
			.eq("id", subjectReference)
			.maybeSingle();
		if (error) throw error;
		return data ? { food_image_asset_id: data.id } : null;
	}
	if (subjectType === "dataset") {
		const { data, error } = await admin
			.from("generic_food_datasets")
			.select("key")
			.eq("key", subjectReference)
			.maybeSingle();
		if (error) throw error;
		return data ? { dataset_key: data.key } : null;
	}
	const { data, error } = await admin
		.from("product_data_sources")
		.select("key")
		.eq("key", subjectReference)
		.maybeSingle();
	if (error) throw error;
	return data ? { source_key: data.key } : null;
};

export const createBlendCalcAPIPublicationConcern = async (
	input: CreateBlendCalcAPIPublicationConcernInput,
) => {
	const contactEmail = normalizeContactEmail(input.contactEmail);
	const subjectReference = normalizeSubjectReference(
		input.subjectType,
		input.subjectReference,
	);
	const details = input.details.trim();
	const evidenceUrls = normalizeEvidenceUrls(input.evidenceUrls);
	if (
		!contactEmail ||
		!subjectReference ||
		!details ||
		details.length > 4000 ||
		evidenceUrls === null
	) {
		return null;
	}

	const target = await findConcernSubject(input.subjectType, subjectReference);
	if (!target) return null;

	const admin = getSupabaseAdminClient();
	const fingerprint = createHash("sha256")
		.update(
			`${input.subjectType}\0${subjectReference}\0${input.concernType}\0${contactEmail}\0${details}`,
		)
		.digest("hex");
	const readDuplicate = () =>
		admin
			.from("blendcalc_api_publication_concerns")
			.select("id, status")
			.eq("concern_fingerprint", fingerprint)
			.in("status", ["open", "triaged"])
			.maybeSingle();
	const { data: duplicate, error: duplicateError } = await readDuplicate();
	if (duplicateError) throw duplicateError;
	if (duplicate) return duplicate;

	const { data, error } = await admin
		.from("blendcalc_api_publication_concerns")
		.insert({
			reporter_type: input.reporterType,
			contact_name: normalizeOptionalText(input.contactName, 160),
			contact_email: contactEmail,
			reporter_user_id: input.reporterUserId ?? null,
			concern_type: input.concernType,
			subject_type: input.subjectType,
			...target,
			subject_reference: subjectReference,
			concern_fingerprint: fingerprint,
			details,
			evidence_urls: evidenceUrls,
			urgency:
				input.concernType === "privacy" ||
				input.concernType === "rights-or-license"
					? "urgent"
					: "normal",
		})
		.select("id, status")
		.single();
	if (error?.code === "23505") {
		const { data: concurrentDuplicate, error: concurrentDuplicateError } =
			await readDuplicate();
		if (concurrentDuplicateError) throw concurrentDuplicateError;
		return concurrentDuplicate;
	}
	if (error) throw error;
	return data;
};

export const readBlendCalcAPIPublicationReviewQueue = async () => {
	const admin = getSupabaseAdminClient();
	const [concernsResponse, holdsResponse] = await Promise.all([
		admin
			.from("blendcalc_api_publication_concerns")
			.select(
				"id, reporter_type, contact_name, contact_email, reporter_user_id, concern_type, subject_type, subject_reference, details, evidence_urls, status, urgency, created_at, updated_at",
			)
			.in("status", ["open", "triaged"])
			.order("urgency", { ascending: false })
			.order("created_at", { ascending: true })
			.limit(100),
		admin
			.from("blendcalc_api_publication_holds")
			.select(
				"id, subject_type, shared_product_id, food_image_asset_id, dataset_key, source_key, reason_code, public_message, concern_id, placed_by, placed_at",
			)
			.is("released_at", null)
			.order("placed_at", { ascending: false })
			.limit(100),
	]);
	if (concernsResponse.error) throw concernsResponse.error;
	if (holdsResponse.error) throw holdsResponse.error;
	return {
		concerns: concernsResponse.data ?? [],
		activeHolds: holdsResponse.data ?? [],
	};
};

export const resolveBlendCalcAPIPublicationConcern = async ({
	concernId,
	status,
	resolutionAction,
	resolutionNote,
	actorUserId,
}: {
	concernId: string;
	status: "resolved" | "dismissed";
	resolutionAction:
		| "product-correction"
		| "image-correction"
		| "source-policy-correction"
		| "publication-hold"
		| "no-change";
	resolutionNote: string;
	actorUserId: string;
}) => {
	const note = resolutionNote.trim();
	if (
		!UUID_PATTERN.test(concernId) ||
		!note ||
		note.length > 4000 ||
		(status === "dismissed" && resolutionAction !== "no-change")
	)
		return false;
	const { data, error } = await getSupabaseAdminClient()
		.from("blendcalc_api_publication_concerns")
		.update({
			status,
			resolution_action: resolutionAction,
			resolution_note: note,
			reviewed_by: actorUserId,
			reviewed_at: new Date().toISOString(),
		})
		.eq("id", concernId)
		.in("status", ["open", "triaged"])
		.select("id")
		.maybeSingle();
	if (error) throw error;
	return Boolean(data);
};

export type BlendCalcAPIPublicationHoldSubject =
	| { subjectType: "product"; subjectReference: string }
	| { subjectType: "image"; subjectReference: string }
	| { subjectType: "dataset"; subjectReference: string }
	| { subjectType: "source"; subjectReference: string };

const readActiveBlendCalcAPIPublicationHold = async (
	subjectType: BlendCalcAPIPublicationSubjectType,
	target: Record<string, string | undefined>,
) => {
	const [targetColumn, targetValue] = Object.entries(target)[0] ?? [];
	if (!targetColumn || !targetValue) return null;
	const { data, error } = await getSupabaseAdminClient()
		.from("blendcalc_api_publication_holds")
		.select("id")
		.eq("subject_type", subjectType)
		.eq(targetColumn, targetValue)
		.is("released_at", null)
		.maybeSingle();
	if (error) throw error;
	return data;
};

export const placeBlendCalcAPIPublicationHold = async ({
	subject,
	reasonCode,
	publicMessage,
	internalNote,
	actorUserId,
	concernId,
}: {
	subject: BlendCalcAPIPublicationHoldSubject;
	reasonCode:
		| "accuracy-review"
		| "rights-review"
		| "attribution-review"
		| "privacy-review"
		| "source-retirement"
		| "legal-request";
	publicMessage: string;
	internalNote: string;
	actorUserId: string;
	concernId?: string;
}) => {
	const normalizedReference = normalizeSubjectReference(
		subject.subjectType,
		subject.subjectReference,
	);
	if (!normalizedReference || !publicMessage.trim() || !internalNote.trim())
		return null;
	const target = await findConcernSubject(
		subject.subjectType,
		normalizedReference,
	);
	if (!target) return null;
	const existingHold = await readActiveBlendCalcAPIPublicationHold(
		subject.subjectType,
		target,
	);
	if (existingHold) return existingHold;
	const { data, error } = await getSupabaseAdminClient()
		.from("blendcalc_api_publication_holds")
		.insert({
			subject_type: subject.subjectType,
			...target,
			reason_code: reasonCode,
			public_message: publicMessage.trim().slice(0, 500),
			internal_note: internalNote.trim().slice(0, 4000),
			concern_id: concernId ?? null,
			placed_by: actorUserId,
		})
		.select("id")
		.single();
	if (error?.code === "23505") {
		return readActiveBlendCalcAPIPublicationHold(subject.subjectType, target);
	}
	if (error) throw error;
	return data;
};

export const releaseBlendCalcAPIPublicationHold = async ({
	holdId,
	actorUserId,
	releaseNote,
}: {
	holdId: string;
	actorUserId: string;
	releaseNote: string;
}) => {
	const note = releaseNote.trim();
	if (!UUID_PATTERN.test(holdId) || !note || note.length > 4000) return false;
	const { data, error } = await getSupabaseAdminClient()
		.from("blendcalc_api_publication_holds")
		.update({
			released_by: actorUserId,
			released_at: new Date().toISOString(),
			release_note: note,
		})
		.eq("id", holdId)
		.is("released_at", null)
		.select("id")
		.maybeSingle();
	if (error) throw error;
	return Boolean(data);
};
