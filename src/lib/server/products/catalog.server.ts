import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import type { Database, Json } from "$lib/types/database.types";
import { normalizeBarcode } from "$lib/utils/barcode/barcode";
import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";
import { compactFood } from "$lib/utils/food/foodRecords";
import { NUTRIENT_IDS, type FdcFood } from "$lib/utils/food/types";
import type { SharedProductSubmissionResult } from "$lib/utils/products/catalog";
import { toJson } from "$lib/utils/storage/supabase/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
	buildModeratorReviewedCatalogBundle,
	buildUsdaVerifiedCatalogBundle,
	type CatalogConflict,
	type CatalogFieldProvenance,
	type CatalogObservation,
} from "./catalogVerification.server";
import {
	lookupOpenFoodFactsBarcodeProduct,
	lookupUsdaBarcodeProduct,
} from "./externalProduct.server";
import {
	createProductEvidenceSignedUrls,
	hasCompleteProductEvidence,
	type ProductEvidencePaths,
} from "./productEvidence.server";

type CatalogSource = "usda" | "community-reviewed";
type CatalogConfidence = "source-verified" | "moderator-reviewed";

type ValidationReport = {
	valid: boolean;
	issues: string[];
	usdaMatch?: boolean;
	openFoodFactsMatch?: boolean;
	externalLookupFailed?: boolean;
	evidenceComplete?: boolean;
	conflictCount?: number;
};

type PendingProductSubmission = {
	id: string;
	submitted_by: string;
	barcode: string;
	product_name: string;
	brand_owner: string | null;
	food: Json;
	matched_source: string | null;
	matched_reference: string | null;
	validation_report: Json;
	evidence_paths: Json;
	evidence_complete: boolean;
	created_at: string;
};

const getNutrientValue = (food: FdcFood, nutrientId: number) =>
	food.foodNutrients.find((nutrient) => nutrient.nutrientId === nutrientId)?.value;

export const validateSharedProductFood = (food: FdcFood) => {
	const issues: string[] = [];
	const barcode = normalizeBarcode(food.barcode ?? food.gtinUpc ?? "");
	if (!barcode) issues.push("A valid GTIN barcode is required.");
	if (!food.description?.trim()) issues.push("A product name is required.");
	if (!Array.isArray(food.foodNutrients) || food.foodNutrients.length === 0) {
		issues.push("At least one nutrition value is required.");
	}
	if (
		food.customServingWeightGrams !== undefined &&
		(!Number.isFinite(food.customServingWeightGrams) ||
			food.customServingWeightGrams <= 0)
	) {
		issues.push("Serving weight must be greater than zero.");
	}

	for (const nutrient of food.foodNutrients ?? []) {
		if (!Number.isFinite(nutrient.value) || nutrient.value < 0) {
			issues.push(`${nutrient.nutrientName || "A nutrient"} has an invalid value.`);
		}
	}

	const carbs = getNutrientValue(food, NUTRIENT_IDS.CARBS);
	const fiber = getNutrientValue(food, NUTRIENT_IDS.FIBER);
	const sugar = getNutrientValue(food, NUTRIENT_IDS.SUGAR);
	if (carbs !== undefined && fiber !== undefined && fiber > carbs) {
		issues.push("Dietary fiber cannot exceed total carbohydrates.");
	}
	if (carbs !== undefined && sugar !== undefined && sugar > carbs) {
		issues.push("Total sugars cannot exceed total carbohydrates.");
	}

	return { barcode, issues, valid: issues.length === 0 };
};

const enrichCatalogFood = (
	row: {
		id: string;
		food: Json;
		confidence: string;
	},
) => ({
	...(row.food as unknown as FdcFood),
	sharedProductId: row.id,
	sharedProductConfidence: row.confidence as FdcFood["sharedProductConfidence"],
	customFood: false,
});

export const getSharedProductByBarcode = async (
	supabase: SupabaseClient<Database>,
	barcode: string,
) => {
	const canonicalBarcode = normalizeBarcode(barcode);
	if (!canonicalBarcode) return null;

	const { data, error } = await supabase
		.from("shared_products")
		.select("id, food, confidence")
		.eq("barcode", canonicalBarcode)
		.eq("status", "active")
		.maybeSingle();
	if (error) throw error;
	return data ? enrichCatalogFood(data) : null;
};

export const searchApprovedSharedProducts = async (
	supabase: SupabaseClient<Database>,
	query: string,
) => {
	const terms = query
		.trim()
		.toLocaleLowerCase()
		.split(/\s+/)
		.map((term) => term.replace(/[%_]/g, ""))
		.filter(Boolean);
	if (terms.length === 0) return [];

	let request = supabase
		.from("shared_products")
		.select("id, food, confidence")
		.eq("status", "active")
		.limit(30);
	for (const term of terms.slice(0, 6)) {
		request = request.ilike("search_text", `%${term}%`);
	}

	const { data, error } = await request;
	if (error) throw error;
	return (data ?? []).map(enrichCatalogFood);
};

const publishSubmission = async (input: {
	submissionId: string;
	food: FdcFood;
	productName: string;
	brandOwner?: string;
	source: CatalogSource;
	sourceReference?: string;
	confidence: CatalogConfidence;
	approvedBy?: string;
	observations: CatalogObservation[];
	provenance: CatalogFieldProvenance[];
	conflicts: CatalogConflict[];
}) => {
	const admin = getSupabaseAdminClient();
	const { data, error } = await admin.rpc("publish_shared_product_submission", {
		p_submission_id: input.submissionId,
		p_food: toJson(compactFood(input.food)),
		p_product_name: input.productName,
		p_brand_owner: input.brandOwner ?? "",
		p_source: input.source,
		p_source_reference: input.sourceReference ?? "",
		p_confidence: input.confidence,
		p_observations: toJson(input.observations),
		p_provenance: toJson(input.provenance),
		p_conflicts: toJson(input.conflicts),
		...(input.approvedBy ? { p_approved_by: input.approvedBy } : {}),
	});
	if (error) throw error;
	return data;
};

const findExistingPendingSubmission = async (barcode: string) => {
	const admin = getSupabaseAdminClient();
	const { data, error } = await admin
		.from("shared_product_submissions")
		.select("id")
		.eq("barcode", barcode)
		.eq("status", "pending")
		.maybeSingle();
	if (error) throw error;
	return data;
};

export const submitProductForCatalog = async (
	userId: string,
	food: FdcFood,
	evidencePaths: ProductEvidencePaths = {},
): Promise<SharedProductSubmissionResult> => {
	const validation = validateSharedProductFood(food);
	if (!validation.valid || !validation.barcode) {
		throw new Error(validation.issues.join(" "));
	}

	const admin = getSupabaseAdminClient();
	const { data: existingProduct, error: productLookupError } = await admin
		.from("shared_products")
		.select("id")
		.eq("barcode", validation.barcode)
		.eq("status", "active")
		.maybeSingle();
	if (productLookupError) throw productLookupError;
	if (existingProduct) {
		return {
			status: "already-available",
			message: "This product is already available to everyone.",
			evidenceAccepted: false,
		};
	}

	const existingSubmission = await findExistingPendingSubmission(validation.barcode);
	if (existingSubmission) {
		return {
			status: "pending",
			message: "This product is already waiting for review.",
			evidenceAccepted: false,
		};
	}

	let usdaDraft: BarcodeProductDraft | null = null;
	let openFoodFactsDraft: BarcodeProductDraft | null = null;
	let externalLookupFailed = false;
	try {
		usdaDraft = await lookupUsdaBarcodeProduct(validation.barcode);
	} catch {
		externalLookupFailed = true;
	}
	if (!usdaDraft) {
		try {
			openFoodFactsDraft = await lookupOpenFoodFactsBarcodeProduct(
				validation.barcode,
			);
		} catch {
			externalLookupFailed = true;
		}
	}

	const report: ValidationReport = {
		valid: true,
		issues: [],
		usdaMatch: Boolean(usdaDraft),
		openFoodFactsMatch: Boolean(openFoodFactsDraft),
		externalLookupFailed,
	};
	const matchedDraft = usdaDraft ?? openFoodFactsDraft;
	if (openFoodFactsDraft && !usdaDraft) {
		return {
			status: "already-available",
			message: "This barcode is already available through Open Food Facts.",
			evidenceAccepted: false,
		};
	}

	const evidenceComplete = hasCompleteProductEvidence(evidencePaths);
	if (!usdaDraft && !evidenceComplete) {
		throw new Error(
			"Unknown products need front package, nutrition label, and barcode photos for verification.",
		);
	}
	const verificationBundle = usdaDraft
		? buildUsdaVerifiedCatalogBundle(food, usdaDraft)
		: null;
	report.evidenceComplete = evidenceComplete;
	report.conflictCount = verificationBundle?.conflicts.length ?? 0;

	const { data: submission, error: submissionError } = await admin
		.from("shared_product_submissions")
		.insert({
			submitted_by: userId,
			barcode: validation.barcode,
			product_name: food.description.trim(),
			brand_owner: food.brandOwner?.trim() || null,
			food: toJson(compactFood(food)),
			consent_to_share: true,
			verification_status: usdaDraft ? "source_verified" : "manual_review",
			matched_source: matchedDraft?.source === "open-food-facts"
				? "open-food-facts"
				: matchedDraft?.source === "usda"
					? "usda"
					: null,
			matched_reference: matchedDraft?.sourceReference ?? null,
			validation_report: toJson(report),
			evidence_paths: toJson(evidencePaths),
			evidence_complete: evidenceComplete,
		})
		.select("id")
		.single();
	if (submissionError || !submission) {
		if (submissionError?.code === "23505") {
			return {
				status: "pending",
				message: "This product is already waiting for review.",
				evidenceAccepted: false,
			};
		}
		throw submissionError ?? new Error("Product submission could not be saved.");
	}

	if (usdaDraft) {
		if (!verificationBundle) {
			throw new Error("USDA verification could not be prepared.");
		}
		try {
			await publishSubmission({
				submissionId: submission.id,
				food: verificationBundle.canonicalFood,
				productName: usdaDraft.name,
				brandOwner: usdaDraft.brandOwner,
				source: "usda",
				sourceReference: usdaDraft.sourceReference,
				confidence: "source-verified",
				observations: verificationBundle.observations,
				provenance: verificationBundle.provenance,
				conflicts: verificationBundle.conflicts,
			});
		} catch (publishError) {
			await admin.from("shared_product_submissions").delete().eq("id", submission.id);
			throw publishError;
		}
		return {
			status: "approved",
			message: "USDA verified this product, so it is now available to everyone.",
			evidenceAccepted: true,
		};
	}

	return {
		status: "pending",
		message: "The product is saved privately and is waiting for a label review.",
		evidenceAccepted: true,
	};
};

export const listPendingProductSubmissions = async () => {
	const admin = getSupabaseAdminClient();
	const { data, error } = await admin
		.from("shared_product_submissions")
		.select(
			"id, submitted_by, barcode, product_name, brand_owner, food, matched_source, matched_reference, validation_report, evidence_paths, evidence_complete, created_at",
		)
		.eq("status", "pending")
		.order("created_at", { ascending: true })
		.limit(100);
	if (error) throw error;
	return Promise.all(((data ?? []) as PendingProductSubmission[]).map(async (submission) => ({
		...submission,
		evidenceUrls: await createProductEvidenceSignedUrls(
			submission.evidence_paths as ProductEvidencePaths,
		),
	})));
};

export const approveCommunityProductSubmission = async (
	submissionId: string,
	moderatorId: string,
) => {
	const admin = getSupabaseAdminClient();
	const { data: submission, error } = await admin
		.from("shared_product_submissions")
		.select("id, product_name, brand_owner, food, status, evidence_complete")
		.eq("id", submissionId)
		.single();
	if (error || !submission) throw error ?? new Error("Submission not found.");
	if (submission.status !== "pending") {
		throw new Error("This product submission has already been reviewed.");
	}
	if (!submission.evidence_complete) {
		throw new Error("Complete label evidence is required before approval.");
	}

	const food = compactFood(submission.food as unknown as FdcFood);
	food.customFood = false;
	food.dataType = "Shared Product";
	food.foodCategory = "Verified Packaged Food";
	food.barcodeSource = "community";
	food.sharedProductConfidence = "moderator-reviewed";

	const verificationBundle = buildModeratorReviewedCatalogBundle(food);
	return publishSubmission({
		submissionId,
		food: verificationBundle.canonicalFood,
		productName: submission.product_name,
		brandOwner: submission.brand_owner ?? undefined,
		source: "community-reviewed",
		confidence: "moderator-reviewed",
		approvedBy: moderatorId,
		observations: verificationBundle.observations,
		provenance: verificationBundle.provenance,
		conflicts: verificationBundle.conflicts,
	});
};

export const rejectProductSubmission = async (
	submissionId: string,
	moderatorId: string,
	reviewNote: string,
) => {
	const admin = getSupabaseAdminClient();
	const { error } = await admin
		.from("shared_product_submissions")
		.update({
			status: "rejected",
			verification_status: "manual_review",
			reviewed_by: moderatorId,
			reviewed_at: new Date().toISOString(),
			review_note: reviewNote.slice(0, 1000),
		})
		.eq("id", submissionId)
		.eq("status", "pending");
	if (error) throw error;
};
