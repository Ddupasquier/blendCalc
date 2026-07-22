import type { ActionData, PageData } from "./$types";

export type PreferenceGroupKey = "allergens" | "dietaryRestrictions";

export type PreferenceGroupMeta = {
	title: string;
	helper: string;
	searchLabel: string;
	selectLabel: string;
};

export type ProfilePageProps = {
	data: PageData;
	form: ActionData;
};
