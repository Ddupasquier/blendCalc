import type { Snippet } from "svelte";
import type { ModeratorActionInformationKey } from "$lib/components/moderation/ModeratorActionInformationSheet/types";

export type ModeratorActionRightSheetProps = {
	id: string;
	title: string;
	subtitle: string;
	informationKey: ModeratorActionInformationKey;
	onClose: () => void;
	children: Snippet;
};
