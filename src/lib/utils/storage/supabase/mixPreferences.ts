import {
	getNumberRecord,
	getObjectRecord,
	resolveCloudClient,
	resolveCloudDataContext,
	toJson,
	type CloudDataContext,
	type CloudMixPreferences,
} from "./shared";

const getBooleanRecord = (value: unknown): Record<string, boolean> => {
	if (!value || typeof value !== "object" || Array.isArray(value)) return {};
	return Object.fromEntries(
		Object.entries(value).filter((entry): entry is [string, boolean] =>
			typeof entry[1] === "boolean"
		),
	);
};

export const readCloudMixPreferences = async (
	context?: CloudDataContext,
): Promise<CloudMixPreferences | null> => {
	const cloud = await resolveCloudDataContext(context);
	if (!cloud) return null;
	const { supabase, userId } = cloud;

	const { data, error } = await supabase
		.from("mix_preferences")
		.select("nutrient_goals, mix_state, section_order, section_disclosure_state")
		.eq("user_id", userId)
		.maybeSingle();

	if (error) return null;
	if (!data) return {};

	return {
		nutrientGoals: getNumberRecord(data.nutrient_goals),
		mixState: getObjectRecord(data.mix_state),
		sectionOrder: data.section_order,
		sectionDisclosureState: getBooleanRecord(data.section_disclosure_state),
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

export const saveCloudMixSectionOrder = async (
	sectionOrder: string[],
	context?: CloudDataContext,
) => {
	const supabase = resolveCloudClient(context);
	if (!supabase) return false;

	const { data, error } = await supabase.rpc("save_mix_section_order", {
		p_section_order: sectionOrder,
	});

	return !error && data === true;
};

export const saveCloudMixSectionDisclosureState = async (
	sectionDisclosureState: Record<string, boolean>,
	context?: CloudDataContext,
) => {
	const supabase = resolveCloudClient(context);
	if (!supabase) return false;

	const { data, error } = await supabase.rpc(
		"save_mix_section_disclosure_state",
		{
			p_section_disclosure_state: toJson(sectionDisclosureState),
		},
	);

	return !error && data === true;
};
