import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash, randomInt, randomUUID } from "node:crypto";
import { parse } from "dotenv";
import { readFile } from "node:fs/promises";
import type { Database, Json } from "$lib/types/database.types";
import { getLocalQaAccountForWorker } from "./localQaAccounts";
import { hasValidGtinCheckDigit } from "../../../src/lib/utils/barcode/barcode";

const localDatabaseHostnames = new Set(["127.0.0.1", "localhost"]);
const authenticatedLocalQaDatabaseClients = new Map<
	number,
	Promise<SupabaseClient<Database>>
>();

const readLocalQaDatabaseEnvironment = async () => {
	const environment = parse(await readFile(".env.test.local"));
	const supabaseUrl = environment.PUBLIC_SUPABASE_URL;
	const publishableKey = environment.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
	const serviceRoleKey = environment.SUPABASE_SERVICE_ROLE_KEY;
	if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
		throw new Error(
			"Local Playwright database access requires the Supabase URL, publishable key, and service-role key.",
		);
	}

	const databaseUrl = new URL(supabaseUrl);
	if (!localDatabaseHostnames.has(databaseUrl.hostname)) {
		throw new Error(
			"Playwright database access is restricted to local Supabase.",
		);
	}

	return { publishableKey, serviceRoleKey, supabaseUrl };
};

const createLocalQaServiceRoleDatabaseClient = async () => {
	const { serviceRoleKey, supabaseUrl } =
		await readLocalQaDatabaseEnvironment();
	return createClient<Database>(supabaseUrl, serviceRoleKey, {
		auth: { autoRefreshToken: false, persistSession: false },
	});
};

/** Pending new/update records and a private control, only in the disposable database. */
export const seedLocalQaCatalogReviewPresentation = async (
	parallelWorkerIndex: number,
) => {
	const admin = await createLocalQaServiceRoleDatabaseClient();
	const userClient =
		await getAuthenticatedLocalQaDatabaseClient(parallelWorkerIndex);
	const {
		data: { user },
		error: userError,
	} = await userClient.auth.getUser();
	if (userError) throw userError;
	if (!user)
		throw new Error("The review-presentation fixture requires a QA user.");
	const { data: product, error: productError } = await admin
		.from("shared_products")
		.select("id, barcode, food")
		.eq("barcode", "00021130462506")
		.eq("status", "active")
		.single();
	if (productError) throw productError;
	const { data: revision, error: revisionError } = await admin
		.from("shared_product_revisions")
		.select("id")
		.eq("shared_product_id", product.id)
		.order("revision_number", { ascending: false })
		.limit(1)
		.single();
	if (revisionError) throw revisionError;
	const { data: originalListItems, error: originalItemsError } = await admin
		.from("user_food_list_items")
		.select(
			"id,user_id,fdc_id,list_type,food,created_at,updated_at,shared_product_id,shared_product_submission_id,source_key,trust_status",
		)
		.eq("user_id", user.id)
		.eq("shared_product_id", product.id);
	if (originalItemsError) throw originalItemsError;
	const foodIds = [-9390001, -9390002, -9390003];
	const submissionIds = [randomUUID(), randomUUID()];
	const barcodePrefix = `9${String(randomInt(1_000_000_000_000)).padStart(12, "0")}`;
	const newBarcode = Array.from(
		{ length: 10 },
		(_, digit) => `${barcodePrefix}${digit}`,
	).find(hasValidGtinCheckDigit)!;
	const canonical = product.food as Record<string, Json>;
	const newFood = {
		fdcId: foodIds[0],
		description: "QA Citrus Extract",
		barcode: newBarcode,
		foodCategory: "Beverages",
		foodNutrients: [],
		sourceKey: "open-food-facts",
	};
	const updatedFood = {
		...canonical,
		fdcId: foodIds[1],
		barcode: product.barcode,
	};
	const privateFood = {
		fdcId: foodIds[2],
		description: "QA Personal Blend",
		customFood: true,
		foodIdentityType: "private-custom",
		foodNutrients: [],
	};
	const cleanup = async () => {
		for (const foodId of foodIds) {
			for (const listType of ["fridge", "shopping"] as const) {
				const { error } = await userClient.rpc("remove_user_food_list_item", {
					p_fdc_id: foodId,
					p_list_type: listType,
				});
				if (error) throw error;
			}
		}
		// Update proposals are immutable audit records; resolve, never bypass that guard.
		const { error: resolveError } = await admin
			.from("shared_product_submissions")
			.update({
				status: "rejected",
				review_note: "Disposable browser fixture cleanup",
			})
			.eq("id", submissionIds[1]);
		if (resolveError) throw resolveError;
		const { error } = await admin
			.from("shared_product_submissions")
			.delete()
			.eq("id", submissionIds[0]);
		if (error) throw error;
		// Placement deduplicates by catalog identity, not only fdcId. Restore the exact
		// baseline rows that this temporary update may have replaced in either list.
		if (originalListItems.length > 0) {
			const { data: restored, error: restoreError } = await admin
				.from("user_food_list_items")
				.upsert(originalListItems)
				.select("id,fdc_id,list_type,trust_status");
			if (restoreError) throw restoreError;
			const describe = (rows: typeof restored) =>
				rows
					.map(
						(row) =>
							`${row.id}:${row.fdc_id}:${row.list_type}:${row.trust_status}`,
					)
					.sort()
					.join("|");
			if (describe(restored) !== describe(originalListItems))
				throw new Error(
					"The review fixture did not restore its original saved-list baseline.",
				);
		}
	};
	try {
		const { error: submissionError } = await admin
			.from("shared_product_submissions")
			.insert([
				{
					id: submissionIds[0],
					submitted_by: user.id,
					barcode: newFood.barcode,
					product_name: newFood.description,
					submission_kind: "new_product",
					change_summary: {},
					food: newFood,
					consent_to_share: true,
					status: "pending",
					validation_report: {
						valid: false,
						issues: ["QA fixture: review required"],
						qaSeed: true,
					},
				},
				{
					id: submissionIds[1],
					submitted_by: user.id,
					barcode: product.barcode,
					product_name: "QA Proposed Jelly Label",
					food: { ...updatedFood, description: "QA Proposed Jelly Label" },
					consent_to_share: true,
					status: "pending",
					submission_kind: "product_update",
					target_shared_product_id: product.id,
					base_revision_id: revision.id,
					change_summary: {
						changes: [
							{
								field: "description",
								label: "Product name",
								changeType: "changed",
								previousValue: canonical.description,
								submittedValue: "QA Proposed Jelly Label",
								severity: "low",
							},
						],
					},
					validation_report: {
						valid: false,
						issues: ["QA fixture: update review required"],
						qaSeed: true,
					},
				},
			]);
		if (submissionError) throw submissionError;
		const { error: placeError } = await userClient.rpc(
			"place_user_food_list_items",
			{ p_foods: [newFood, updatedFood, privateFood], p_list_type: "fridge" },
		);
		if (placeError) throw placeError;
		const { data: stored, error: storedError } = await userClient
			.from("user_food_list_items")
			.select("fdc_id,trust_status,shared_product_id")
			.in("fdc_id", foodIds);
		if (storedError) throw storedError;
		if (
			stored?.length !== 3 ||
			stored.filter((row) => row.trust_status === "pending-review").length !==
				2 ||
			!stored.find((row) => row.fdc_id === foodIds[1])?.shared_product_id
		)
			throw new Error(
				"The pending-review fixture did not project real new/update states.",
			);
		return {
			foodIds,
			pendingSearchFood: {
				...newFood,
				trustStatus: "pending-review",
				sharedProductSubmissionId: submissionIds[0],
			},
			cleanup,
		};
	} catch (error) {
		await cleanup();
		throw error;
	}
};

export const createLocalQaPendingNutrientMapping = async () => {
	const admin = await createLocalQaServiceRoleDatabaseClient();
	const sourceNutrientKey = `qa-browser-omega-6-${randomUUID()}`;
	const { data, error } = await admin
		.from("nutrient_source_mappings")
		.insert({
			confidence: 1,
			enabled: false,
			mapping_method: "api_taxonomy_match",
			nutrient_id: 700855,
			priority: 100,
			provenance: {
				fixture: true,
				reason:
					"A broad parent nutrient label still requires an exact identity decision.",
			},
			review_status: "pending_review",
			source_key: "open-food-facts",
			source_nutrient_key: sourceNutrientKey,
			source_nutrient_name: "Omega-6 fatty acids",
			source_unit_name: "G",
		})
		.select("id")
		.single();
	if (error) throw error;
	return data.id;
};

export const deleteLocalQaPendingNutrientMapping = async (
	mappingId: string,
) => {
	const admin = await createLocalQaServiceRoleDatabaseClient();
	const { error } = await admin
		.from("nutrient_source_mappings")
		.delete()
		.eq("id", mappingId);
	if (error) throw error;
};

export const recheckLocalQaDeterministicNutrientMapping = async () => {
	const admin = await createLocalQaServiceRoleDatabaseClient();
	const { data: mapping, error: findError } = await admin
		.from("nutrient_source_mappings")
		.select("id")
		.eq("source_key", "open-food-facts")
		.eq("source_nutrient_key", "arachidonic-acid")
		.eq("source_unit_name", "G")
		.single();
	if (findError) throw findError;

	const { error: updateError } = await admin
		.from("nutrient_source_mappings")
		.update({
			enabled: false,
			review_reference: null,
			review_status: "pending_review",
			reviewed_at: null,
		})
		.eq("id", mapping.id);
	if (updateError) throw updateError;

	const { data: rechecked, error: recheckError } = await admin
		.from("nutrient_source_mappings")
		.select("enabled, id, review_status")
		.eq("id", mapping.id)
		.single();
	if (recheckError) throw recheckError;
	if (rechecked.review_status !== "approved" || !rechecked.enabled) {
		throw new Error(
			"The deterministic nutrient rule did not remove the rechecked mapping from human review.",
		);
	}

	return rechecked.id;
};

export const resetLocalQaDatasetImportEvidence = async (datasetKey: string) => {
	const admin = await createLocalQaServiceRoleDatabaseClient();
	const { data: dataset, error: readError } = await admin
		.from("generic_food_datasets")
		.select("metadata")
		.eq("key", datasetKey)
		.single();
	if (readError) throw readError;
	const metadata =
		dataset.metadata &&
		typeof dataset.metadata === "object" &&
		!Array.isArray(dataset.metadata)
			? { ...dataset.metadata }
			: {};
	delete metadata.importEvidence;
	const { error: updateError } = await admin
		.from("generic_food_datasets")
		.update({
			imported_at: null,
			metadata,
			source_file_sha256: null,
		})
		.eq("key", datasetKey);
	if (updateError) throw updateError;
};

const findLocalQaUserByEmail = async (email: string) => {
	const admin = await createLocalQaServiceRoleDatabaseClient();
	const { data: users, error: usersError } = await admin.auth.admin.listUsers({
		page: 1,
		perPage: 1000,
	});
	if (usersError) throw usersError;
	const user = users.users.find(
		(candidate) =>
			candidate.email?.toLocaleLowerCase() === email.toLocaleLowerCase(),
	);
	if (!user) throw new Error(`The local QA account ${email} does not exist.`);
	return { admin, user };
};

/** More than two tied-timestamp pages, isolated to disposable local Supabase. */
export const seedLocalQaFoodWarningQueues = async (email: string) => {
	const { admin, user } = await findLocalQaUserByEmail(email);
	const { data: product, error: productError } = await admin
		.from("shared_product_revisions")
		.select("id, shared_product_id")
		.order("created_at", { ascending: false })
		.limit(1)
		.single();
	if (productError) throw productError;
	const { data: tag, error: tagError } = await admin
		.from("compatibility_tags")
		.select("id")
		.eq("slug", "soy")
		.single();
	if (tagError) throw tagError;
	const reportIds = Array.from({ length: 75 }, () => randomUUID()).sort();
	const createdAt = "2000-01-01T00:00:00.123456Z";
	const evidencePath = `${user.id}/${randomUUID()}/paged-warning.png`;
	const evidenceBytes = Buffer.from(
		"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
		"base64",
	);
	const cleanup = async () => {
		const { error } = await admin
			.from("food_compatibility_feedback")
			.delete()
			.in("id", reportIds);
		if (error) throw error;
		const { error: storageError } = await admin.storage
			.from("product-submission-evidence")
			.remove([evidencePath]);
		if (storageError) throw storageError;
	};
	try {
		const { error: uploadError } = await admin.storage
			.from("product-submission-evidence")
			.upload(evidencePath, evidenceBytes, { contentType: "image/png" });
		if (uploadError) throw uploadError;
		const { error } = await admin.from("food_compatibility_feedback").insert(
			reportIds.map((id, index) => ({
				id,
				reported_by: user.id,
				food_description: `QA Paged Warning ${String(index + 1).padStart(2, "0")}`,
				shared_product_id: product.shared_product_id,
				shared_product_revision_id: product.id,
				report_reason: "wrong_evidence_type",
				feedback_type: "incorrect_warning",
				warning_id: "qa-allergen-soy",
				issue_code: "FOOD_ALLERGEN_CONTAINS",
				report_fingerprint: createHash("sha256").update(id).digest("hex"),
				created_at: createdAt,
				...(index === 0
					? {
							feedback_type: "missing_warning",
							report_reason: "missing_warning",
							warning_id: null,
							issue_code: null,
							preference_type: "allergen",
							preference_value: "Soy",
							preference_tag_id: tag.id,
							evidence_path: evidencePath,
							evidence_sha256: createHash("sha256")
								.update(evidenceBytes)
								.digest("hex"),
						}
					: {}),
				...(index >= 25
					? {
							status: "confirmed",
							decision_method: "human",
							reviewed_by: user.id,
							reviewed_at: createdAt,
							review_note: "Reviewed local QA fixture.",
							resolution_action:
								index >= 50
									? "product_correction"
									: (index - 25) % 2
										? "source_correction"
										: "rule_review",
							follow_up_status: "open",
						}
					: {}),
			})),
			{ defaultToNull: false },
		);
		if (error) throw error;
		const policyIds = Array.from({ length: 25 }, () => randomUUID()).sort();
		const { error: policyError } = await admin
			.from("food_warning_policy_review_cases")
			.insert(
				policyIds.map((id, index) => ({
					id,
					feedback_id: reportIds[index + 25],
					created_at: createdAt,
					case_type: index % 2 ? "source_correction" : "rule_review",
					responsible_group:
						index % 2 ? "data_operations" : "food_policy_review",
					status: index === 2 ? "deferred" : "open",
					opened_by: user.id,
				})),
			);
		if (policyError) throw policyError;
		const { error: correctionError } = await admin
			.from("catalog_correction_origins")
			.insert(
				reportIds.slice(50).map((id) => ({
					food_compatibility_feedback_id: id,
					shared_product_id: product.shared_product_id,
					base_revision_id: product.id,
					origin_type: "food_warning_report",
					affected_field_paths: ["allergens"],
					prefilled_food: {},
					created_at: createdAt,
				})),
			);
		if (correctionError) throw correctionError;
		return {
			reportIds: reportIds.slice(0, 25),
			policyIds,
			cleanup,
			resolveLoadedReport: async () => {
				const { error } = await admin
					.from("food_compatibility_feedback")
					.update({
						status: "dismissed",
						reviewed_by: user.id,
						reviewed_at: new Date().toISOString(),
						review_note: "Concurrent local QA decision.",
						resolution_action: "none",
					})
					.eq("id", reportIds[0]);
				if (error) throw error;
			},
		};
	} catch (error) {
		await cleanup();
		throw error;
	}
};

export const getAuthenticatedLocalQaDatabaseClient = async (
	parallelWorkerIndex: number,
): Promise<SupabaseClient<Database>> => {
	const existingClient =
		authenticatedLocalQaDatabaseClients.get(parallelWorkerIndex);
	if (existingClient) return existingClient;

	const clientPromise = (async () => {
		const { publishableKey, supabaseUrl } =
			await readLocalQaDatabaseEnvironment();

		const supabase = createClient<Database>(supabaseUrl, publishableKey, {
			auth: { autoRefreshToken: false, persistSession: false },
		});
		const account = getLocalQaAccountForWorker(parallelWorkerIndex);
		const { error: signInError } =
			await supabase.auth.signInWithPassword(account);
		if (signInError) throw signInError;

		return supabase;
	})();
	authenticatedLocalQaDatabaseClients.set(parallelWorkerIndex, clientPromise);

	try {
		return await clientPromise;
	} catch (error) {
		authenticatedLocalQaDatabaseClients.delete(parallelWorkerIndex);
		throw error;
	}
};

export const deleteLocalQaAuthenticatorFactorsForEmail = async (
	email: string,
) => {
	const { admin, user } = await findLocalQaUserByEmail(email);

	const { data: factors, error: factorsError } =
		await admin.auth.admin.mfa.listFactors({ userId: user.id });
	if (factorsError) throw factorsError;
	for (const factor of factors.factors) {
		const { error: deleteError } = await admin.auth.admin.mfa.deleteFactor({
			id: factor.id,
			userId: user.id,
		});
		if (deleteError) throw deleteError;
	}
};

const localQaRevisionHistoryProductId = "81000000-0000-4000-8000-000000000061";
const localQaRevisionHistoryRevisionId = "72900000-0000-4000-8000-000000000010";

export type LocalQaCatalogRevisionHistoryFixture = {
	productId: string;
};

const removeLocalQaCatalogRevisionHistoryFixture = async (
	admin: SupabaseClient<Database>,
) => {
	const { data: occurrences, error: occurrenceError } = await admin
		.from("catalog_health_issue_occurrences")
		.select("occurrence_key")
		.eq("shared_product_id", localQaRevisionHistoryProductId)
		.eq("source_scope", "catalog_revision");
	if (occurrenceError) throw occurrenceError;

	const occurrenceKeys = (occurrences ?? [])
		.map((occurrence) => occurrence.occurrence_key)
		.filter((occurrenceKey): occurrenceKey is string => Boolean(occurrenceKey));
	if (occurrenceKeys.length > 0) {
		const { error: repairError } = await admin
			.from("catalog_health_repair_runs")
			.delete()
			.in("occurrence_key", occurrenceKeys);
		if (repairError) throw repairError;
	}

	const { error: dispositionError } = await admin
		.from("catalog_health_review_dispositions")
		.delete()
		.eq("shared_product_id", localQaRevisionHistoryProductId);
	if (dispositionError) throw dispositionError;

	const { error: revisionError } = await admin
		.from("shared_product_revisions")
		.delete()
		.eq("id", localQaRevisionHistoryRevisionId);
	if (revisionError) throw revisionError;
};

export const seedLocalQaCatalogRevisionHistory =
	async (): Promise<LocalQaCatalogRevisionHistoryFixture> => {
		const admin = await createLocalQaServiceRoleDatabaseClient();
		await removeLocalQaCatalogRevisionHistoryFixture(admin);

		const { data: revision, error: revisionReadError } = await admin
			.from("shared_product_revisions")
			.select("*")
			.eq("shared_product_id", localQaRevisionHistoryProductId)
			.eq("revision_number", 1)
			.single();
		if (revisionReadError) throw revisionReadError;
		if (
			!revision.food ||
			typeof revision.food !== "object" ||
			Array.isArray(revision.food)
		) {
			throw new Error("The local catalog revision fixture has no food object.");
		}
		const food = revision.food as Record<string, Json>;
		const fieldProvenance =
			food.fieldProvenance &&
			typeof food.fieldProvenance === "object" &&
			!Array.isArray(food.fieldProvenance)
				? (food.fieldProvenance as Record<string, Json>)
				: {};

		const { error: revisionInsertError } = await admin
			.from("shared_product_revisions")
			.insert({
				...revision,
				id: localQaRevisionHistoryRevisionId,
				revision_number: 2,
				food: {
					...food,
					fieldProvenance: {
						...fieldProvenance,
						ingredients: {
							source: "usda",
							confidence: "source-verified",
							sourceReference: "qa-visible-revision",
						},
					},
				},
				change_summary: {},
				label_observed_at: "2026-09-10T12:00:00.000Z",
				created_at: "2026-09-10T12:00:00.000Z",
			});
		if (revisionInsertError) throw revisionInsertError;

		const { count: changeCount, error: changeError } = await admin
			.from("shared_product_revision_changes")
			.select("id", { count: "exact", head: true })
			.eq("revision_id", localQaRevisionHistoryRevisionId);
		if (changeError) throw changeError;
		if (!changeCount) {
			throw new Error(
				"The local catalog revision fixture did not create exact change rows.",
			);
		}

		return {
			productId: localQaRevisionHistoryProductId,
		};
	};

export const cleanupLocalQaCatalogRevisionHistory = async () => {
	const admin = await createLocalQaServiceRoleDatabaseClient();
	await removeLocalQaCatalogRevisionHistoryFixture(admin);
};

export const seedLocalQaCatalogValueConflict = async () => {
	const admin = await createLocalQaServiceRoleDatabaseClient();
	const id = randomUUID();
	const productId = localQaRevisionHistoryProductId;
	const { error } = await admin.from("shared_product_conflicts").insert({
		id,
		shared_product_id: productId,
		barcode: "00072360002031",
		field_path: "nutrient:1093",
		observed_values: [
			{
				source: "usda",
				sourceReference: "1862061",
				value: 643,
				unitName: "MG",
				basis: "per 100 g",
			},
			{
				source: "open-food-facts",
				sourceReference: "00072360002031",
				value: 400,
				unitName: "MG",
				basis: "per 100 g",
			},
		],
		severity: "medium",
		status: "open",
	});
	if (error) throw error;
	return { id, productId };
};

export const deleteLocalQaCatalogValueConflict = async (conflictId: string) => {
	const admin = await createLocalQaServiceRoleDatabaseClient();
	const { error } = await admin
		.from("shared_product_conflicts")
		.delete()
		.eq("id", conflictId);
	if (error) throw error;
};

export type LocalQaCatalogSubmissionEnforcementSnapshot = {
	enforcement:
		| Database["public"]["Tables"]["user_catalog_submission_enforcement"]["Row"]
		| null;
	userId: string;
};

export const captureAndSetLocalQaCatalogSubmissionSuspension = async ({
	email,
	moderatorRejectionCount = 51,
}: {
	email: string;
	moderatorRejectionCount?: number;
}): Promise<LocalQaCatalogSubmissionEnforcementSnapshot> => {
	const { admin, user } = await findLocalQaUserByEmail(email);
	const { data: enforcement, error: enforcementError } = await admin
		.from("user_catalog_submission_enforcement")
		.select("*")
		.eq("user_id", user.id)
		.maybeSingle();
	if (enforcementError) throw enforcementError;

	const now = new Date();
	const suspensionEnd = new Date(now);
	suspensionEnd.setUTCMonth(suspensionEnd.getUTCMonth() + 6);
	const { error: upsertError } = await admin
		.from("user_catalog_submission_enforcement")
		.upsert({
			user_id: user.id,
			moderator_rejection_count: moderatorRejectionCount,
			sharing_suspended_until: suspensionEnd.toISOString(),
			latest_rejected_at: now.toISOString(),
			updated_at: now.toISOString(),
		});
	if (upsertError) throw upsertError;

	return { enforcement, userId: user.id };
};

export const restoreLocalQaCatalogSubmissionEnforcement = async ({
	enforcement,
	userId,
}: LocalQaCatalogSubmissionEnforcementSnapshot) => {
	const admin = await createLocalQaServiceRoleDatabaseClient();
	if (enforcement) {
		const { error } = await admin
			.from("user_catalog_submission_enforcement")
			.upsert(enforcement);
		if (error) throw error;
		return;
	}

	const { error } = await admin
		.from("user_catalog_submission_enforcement")
		.delete()
		.eq("user_id", userId);
	if (error) throw error;
};

type LocalQaMixGoalConfigurationSnapshot = {
	goalBasis: string;
	goalTemplateCustomized: boolean;
	mixState: Json;
	sourceGoalTemplateVersionId: string | null;
	sourceUserGoalTemplateId: string | null;
	goals: Array<{
		goal_type: string;
		importance_weight: number;
		nutrient_id: number;
		sort_order: number;
		target_amount: number;
		tolerance_ratio: number;
		upper_amount: number | null;
	}>;
};

type LocalQaIngredientListItem = Pick<
	Database["public"]["Tables"]["user_food_list_items"]["Row"],
	"fdc_id" | "food" | "list_type"
>;

export type LocalQaSavedRecipeRecord = {
	id: string;
	name: string;
	recipe: Record<string, Json | undefined>;
};

export const captureLocalQaMixGoalConfiguration = async (
	parallelWorkerIndex: number,
): Promise<LocalQaMixGoalConfigurationSnapshot> => {
	const supabase =
		await getAuthenticatedLocalQaDatabaseClient(parallelWorkerIndex);

	const { data: authenticatedUser, error: userError } =
		await supabase.auth.getUser();
	if (userError || !authenticatedUser.user) {
		throw (
			userError ?? new Error("The local QA Mix owner could not be verified.")
		);
	}

	const [
		{ data: preferences, error: preferencesError },
		{ data: goals, error: goalsError },
	] = await Promise.all([
		supabase
			.from("mix_preferences")
			.select(
				"goal_basis, goal_template_customized, mix_state, source_goal_template_version_id, source_user_goal_template_id",
			)
			.eq("user_id", authenticatedUser.user.id)
			.single(),
		supabase
			.from("user_mix_nutrient_goals")
			.select(
				"goal_type, importance_weight, nutrient_id, sort_order, target_amount, tolerance_ratio, upper_amount",
			)
			.eq("user_id", authenticatedUser.user.id)
			.order("sort_order"),
	]);
	if (preferencesError) throw preferencesError;
	if (goalsError) throw goalsError;

	return {
		goalBasis: preferences.goal_basis,
		goalTemplateCustomized: preferences.goal_template_customized,
		mixState: preferences.mix_state,
		sourceGoalTemplateVersionId: preferences.source_goal_template_version_id,
		sourceUserGoalTemplateId: preferences.source_user_goal_template_id,
		goals: goals ?? [],
	};
};
export const restoreLocalQaMixGoalConfiguration = async (
	parallelWorkerIndex: number,
	snapshot: LocalQaMixGoalConfigurationSnapshot,
) => {
	const supabase =
		await getAuthenticatedLocalQaDatabaseClient(parallelWorkerIndex);

	const [goalResult, stateResult] = await Promise.all([
		supabase.rpc("save_mix_goal_configuration", {
			p_customized: snapshot.goalTemplateCustomized,
			p_goal_basis: snapshot.goalBasis,
			p_goals: snapshot.goals as Json,
			...(snapshot.sourceGoalTemplateVersionId
				? {
						p_source_template_version_id: snapshot.sourceGoalTemplateVersionId,
					}
				: {}),
			...(snapshot.sourceUserGoalTemplateId
				? { p_source_user_template_id: snapshot.sourceUserGoalTemplateId }
				: {}),
		}),
		supabase.rpc("save_mix_preferences", {
			p_mix_state: snapshot.mixState,
		}),
	]);
	if (goalResult.error) throw goalResult.error;
	if (stateResult.error) throw stateResult.error;
};

export const saveLocalQaMixState = async (
	parallelWorkerIndex: number,
	mixState: Json,
) => {
	const supabase =
		await getAuthenticatedLocalQaDatabaseClient(parallelWorkerIndex);

	const { error } = await supabase.rpc("save_mix_preferences", {
		p_mix_state: mixState,
	});
	if (error) throw error;
};

export type LocalQaMixSectionPreferencesSnapshot = {
	order: string[];
	disclosureState: Json;
};

export const captureLocalQaMixSectionPreferences = async (
	parallelWorkerIndex: number,
): Promise<LocalQaMixSectionPreferencesSnapshot> => {
	const supabase =
		await getAuthenticatedLocalQaDatabaseClient(parallelWorkerIndex);
	const { data, error } = await supabase
		.from("mix_preferences")
		.select("section_order, section_disclosure_state")
		.single();
	if (error) throw error;
	return {
		order: data.section_order,
		disclosureState: data.section_disclosure_state,
	};
};

export const saveLocalQaMixSectionPreferences = async (
	parallelWorkerIndex: number,
	preferences: LocalQaMixSectionPreferencesSnapshot,
) => {
	const supabase =
		await getAuthenticatedLocalQaDatabaseClient(parallelWorkerIndex);
	const orderResult = await supabase.rpc("save_mix_section_order", {
		p_section_order: preferences.order,
	});
	if (orderResult.error) throw orderResult.error;
	const disclosureResult = await supabase.rpc(
		"save_mix_section_disclosure_state",
		{ p_section_disclosure_state: preferences.disclosureState },
	);
	if (disclosureResult.error) throw disclosureResult.error;
};

export const restoreLocalQaMixSectionPreferences =
	saveLocalQaMixSectionPreferences;

export const captureAndClearLocalQaIngredientLists = async (
	parallelWorkerIndex: number,
): Promise<LocalQaIngredientListItem[]> => {
	const supabase =
		await getAuthenticatedLocalQaDatabaseClient(parallelWorkerIndex);

	const { data: listItems, error: listItemsError } = await supabase
		.from("user_food_list_items")
		.select("fdc_id, food, list_type")
		.order("created_at");
	if (listItemsError) throw listItemsError;

	for (const listItem of listItems ?? []) {
		const { data: removed, error } = await supabase.rpc(
			"remove_user_food_list_item",
			{
				p_fdc_id: listItem.fdc_id,
				p_list_type: listItem.list_type,
			},
		);
		if (error) throw error;
		if (!removed) {
			throw new Error(
				`Local QA food ${listItem.fdc_id} could not be removed from ${listItem.list_type}.`,
			);
		}
	}

	return listItems ?? [];
};

export const restoreLocalQaIngredientLists = async (
	parallelWorkerIndex: number,
	listItems: LocalQaIngredientListItem[],
) => {
	if (listItems.length === 0) return;
	const supabase =
		await getAuthenticatedLocalQaDatabaseClient(parallelWorkerIndex);
	for (const listType of ["fridge", "shopping"] as const) {
		const foods = listItems
			.filter((listItem) => listItem.list_type === listType)
			.map((listItem) => listItem.food);
		if (foods.length === 0) continue;
		const { error } = await supabase.rpc("place_user_food_list_items", {
			p_foods: foods,
			p_list_type: listType,
		});
		if (error) throw error;
	}
};

export const saveLocalQaMixGoalConfiguration = async (
	parallelWorkerIndex: number,
	goals: LocalQaMixGoalConfigurationSnapshot["goals"],
) => {
	const supabase =
		await getAuthenticatedLocalQaDatabaseClient(parallelWorkerIndex);

	const { error } = await supabase.rpc("save_mix_goal_configuration", {
		p_customized: true,
		p_goal_basis: "per_mix",
		p_goals: goals as Json,
	});
	if (error) throw error;
};

export const readLocalQaSavedRecipesByNamePrefix = async (
	parallelWorkerIndex: number,
	namePrefix: string,
): Promise<LocalQaSavedRecipeRecord[]> => {
	const supabase =
		await getAuthenticatedLocalQaDatabaseClient(parallelWorkerIndex);

	const { data, error } = await supabase
		.from("saved_drinks")
		.select("id, name, drink")
		.ilike("name", `${namePrefix}%`)
		.order("created_at", { ascending: true });
	if (error) throw error;

	return (data ?? []).map((row) => ({
		id: row.id,
		name: row.name,
		recipe: row.drink as Record<string, Json | undefined>,
	}));
};

export const deleteLocalQaSavedRecipesByNamePrefix = async (
	parallelWorkerIndex: number,
	namePrefix: string,
) => {
	const supabase =
		await getAuthenticatedLocalQaDatabaseClient(parallelWorkerIndex);

	const { data, error } = await supabase
		.from("saved_drinks")
		.select("id")
		.ilike("name", `${namePrefix}%`);
	if (error) throw error;

	for (const row of data ?? []) {
		const { data: deleted, error: deleteError } = await supabase.rpc(
			"delete_saved_drink",
			{ p_id: row.id },
		);
		if (deleteError) throw deleteError;
		if (deleted !== true) {
			throw new Error(`Local QA recipe ${row.id} could not be deleted.`);
		}
	}
};
