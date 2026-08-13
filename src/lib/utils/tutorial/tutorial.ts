import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "$lib/types/database.types";

export const CURRENT_TUTORIAL_VERSION = 3;

export type TutorialPreference = Tables<"user_tutorial_preferences">;

export const shouldAutomaticallyShowTutorial = (
	preference: TutorialPreference | null | undefined,
) => {
	if (preference === undefined) return false;
	if (preference === null) return true;
	if (preference.tutorial_version < CURRENT_TUTORIAL_VERSION) return true;
	if (preference.do_not_show_again || preference.completed_at) return false;
	if (preference.remind_after) return false;
	return true;
};

export const getTutorialPreference = async (
	supabase: SupabaseClient<Database>,
	userId: string,
) => {
	const { data, error } = await supabase
		.from("user_tutorial_preferences")
		.select(
			"user_id, tutorial_version, do_not_show_again, remind_after, last_seen_at, completed_at, created_at, updated_at",
		)
		.eq("user_id", userId)
		.maybeSingle();

	if (error) return undefined;
	return data;
};

export const writeTutorialCompletion = async (
	supabase: SupabaseClient<Database>,
	userId: string,
	now = new Date(),
) => {
	const { error } = await supabase.from("user_tutorial_preferences").upsert(
		{
			user_id: userId,
			tutorial_version: CURRENT_TUTORIAL_VERSION,
			do_not_show_again: true,
			remind_after: null,
			last_seen_at: now.toISOString(),
			completed_at: now.toISOString(),
		},
		{ onConflict: "user_id" },
	);

	return !error;
};
