import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { parse } from "dotenv";
import { readFile } from "node:fs/promises";
import type { Database, Json } from "$lib/types/database.types";
import { getLocalQaAccountForWorker } from "./localQaAccounts";

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
