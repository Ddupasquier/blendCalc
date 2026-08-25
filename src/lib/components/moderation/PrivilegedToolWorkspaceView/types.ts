import type { Snippet } from "svelte";
import type { StatusMessageTone } from "$lib/components/common/feedback/StatusMessage/types";
import type { PrivilegedToolInformationKey } from "$lib/components/moderation/PrivilegedToolInformationSheet/types";

export type PrivilegedToolWorkspaceViewProps = {
	id: string;
	title: string;
	subtitle: string;
	informationKey: PrivilegedToolInformationKey;
	feedbackMessage?: string;
	feedbackTone?: StatusMessageTone;
	onClose: () => void;
	children: Snippet;
};
