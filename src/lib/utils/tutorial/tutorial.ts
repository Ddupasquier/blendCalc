import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "$lib/types/database.types";

export const CURRENT_TUTORIAL_VERSION = 3;
export const TUTORIAL_REMINDER_DAYS = 7;

export type TutorialPreference = Tables<"user_tutorial_preferences">;
export type TutorialChoice = "complete" | "later";

export const shouldAutomaticallyShowTutorial = (
	preference: TutorialPreference | null | undefined,
	now = new Date(),
) => {
	if (preference === undefined) return false;
	if (preference === null) return true;
	if (preference.tutorial_version < CURRENT_TUTORIAL_VERSION) return true;
	if (preference.do_not_show_again || preference.completed_at) return false;
	if (!preference.remind_after) return true;

	const remindAfter = new Date(preference.remind_after);
	return (
		!Number.isNaN(remindAfter.getTime()) &&
		remindAfter.getTime() <= now.getTime()
	);
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

export const writeTutorialChoice = async (
	supabase: SupabaseClient<Database>,
	userId: string,
	choice: TutorialChoice,
	now = new Date(),
) => {
	const completed = choice === "complete";
	const remindAfter = new Date(now);
	remindAfter.setUTCDate(
		remindAfter.getUTCDate() + TUTORIAL_REMINDER_DAYS,
	);

	const { error } = await supabase.from("user_tutorial_preferences").upsert(
		{
			user_id: userId,
			tutorial_version: CURRENT_TUTORIAL_VERSION,
			do_not_show_again: completed,
			remind_after: completed ? null : remindAfter.toISOString(),
			last_seen_at: now.toISOString(),
			completed_at: completed ? now.toISOString() : null,
		},
		{ onConflict: "user_id" },
	);

	return !error;
};
