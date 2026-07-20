import {
	getNumberRecord,
	getObjectRecord,
	resolveCloudClient,
	resolveCloudDataContext,
	toJson,
	type CloudDataContext,
	type CloudMixPreferences,
} from "./shared";

export const readCloudMixPreferences = async (
	context?: CloudDataContext,
): Promise<CloudMixPreferences | null> => {
	const cloud = await resolveCloudDataContext(context);
	if (!cloud) return null;
	const { supabase, userId } = cloud;

	const { data, error } = await supabase
		.from("mix_preferences")
		.select("nutrient_goals, mix_state")
		.eq("user_id", userId)
		.maybeSingle();

	if (error) return null;
	if (!data) return {};

	return {
		nutrientGoals: getNumberRecord(data.nutrient_goals),
		mixState: getObjectRecord(data.mix_state),
	};
};

export const saveCloudMixPreferences = async ({
	nutrientGoals,
	mixState,
}: CloudMixPreferences, context?: CloudDataContext) => {
	const supabase = resolveCloudClient(context);
	if (!supabase) return false;

	const { data, error } = await supabase.rpc("save_mix_preferences", {
		p_nutrient_goals: nutrientGoals === undefined ? undefined : toJson(nutrientGoals),
		p_mix_state: mixState === undefined ? undefined : toJson(mixState),
	});

	return !error && data === true;
};
