import type { Snippet } from "svelte";
import type { PrivilegedToolInformationKey } from "$lib/components/moderation/PrivilegedToolInformationSheet/types";

export type PrivilegedToolRightSheetProps = {
	id: string;
	title: string;
	subtitle: string;
	informationKey: PrivilegedToolInformationKey;
	onClose: () => void;
	children: Snippet;
};
