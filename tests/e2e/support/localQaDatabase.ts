import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { parse } from "dotenv";
import { readFile } from "node:fs/promises";
import type { Database, Json } from "$lib/types/database.types";
import { getLocalQaAccountForWorker } from "./localQaAccounts";

const localDatabaseHostnames = new Set(["127.0.0.1", "localhost"]);

export const createAuthenticatedLocalQaDatabaseClient = async (
	parallelWorkerIndex: number,
): Promise<SupabaseClient<Database>> => {
	const environment = parse(await readFile(".env.test.local"));
	const supabaseUrl = environment.PUBLIC_SUPABASE_URL;
	const publishableKey = environment.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
	if (!supabaseUrl || !publishableKey) {
		throw new Error(
			"Local Playwright database access requires PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
		);
	}

	const databaseUrl = new URL(supabaseUrl);
	if (!localDatabaseHostnames.has(databaseUrl.hostname)) {
		throw new Error("Playwright database access is restricted to local Supabase.");
	}

	const supabase = createClient<Database>(supabaseUrl, publishableKey, {
		auth: { autoRefreshToken: false, persistSession: false },
	});
	const account = getLocalQaAccountForWorker(parallelWorkerIndex);
	const { error: signInError } = await supabase.auth.signInWithPassword(account);
	if (signInError) throw signInError;

	return supabase;
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

export const captureLocalQaMixGoalConfiguration = async (
	parallelWorkerIndex: number,
): Promise<LocalQaMixGoalConfigurationSnapshot> => {
	const supabase = await createAuthenticatedLocalQaDatabaseClient(
		parallelWorkerIndex,
	);

	try {
		const { data: authenticatedUser, error: userError } =
			await supabase.auth.getUser();
		if (userError || !authenticatedUser.user) {
			throw userError ?? new Error("The local QA Mix owner could not be verified.");
		}

		const [{ data: preferences, error: preferencesError }, { data: goals, error: goalsError }] =
			await Promise.all([
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
			sourceGoalTemplateVersionId:
				preferences.source_goal_template_version_id,
			sourceUserGoalTemplateId: preferences.source_user_goal_template_id,
			goals: goals ?? [],
		};
	} finally {
		await supabase.auth.signOut({ scope: "local" });
	}
};

export const restoreLocalQaMixGoalConfiguration = async (
	parallelWorkerIndex: number,
	snapshot: LocalQaMixGoalConfigurationSnapshot,
) => {
	const supabase = await createAuthenticatedLocalQaDatabaseClient(
		parallelWorkerIndex,
	);

	try {
		const [goalResult, stateResult] = await Promise.all([
			supabase.rpc("save_mix_goal_configuration", {
				p_customized: snapshot.goalTemplateCustomized,
				p_goal_basis: snapshot.goalBasis,
				p_goals: snapshot.goals as Json,
				...(snapshot.sourceGoalTemplateVersionId
					? {
							p_source_template_version_id:
								snapshot.sourceGoalTemplateVersionId,
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
	} finally {
		await supabase.auth.signOut({ scope: "local" });
	}
};

export const saveLocalQaMixState = async (
	parallelWorkerIndex: number,
	mixState: Json,
) => {
	const supabase = await createAuthenticatedLocalQaDatabaseClient(
		parallelWorkerIndex,
	);

	try {
		const { error } = await supabase.rpc("save_mix_preferences", {
			p_mix_state: mixState,
		});
		if (error) throw error;
	} finally {
		await supabase.auth.signOut({ scope: "local" });
	}
};
