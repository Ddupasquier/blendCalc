import type { Snippet } from "svelte";
import type { StatusMessageTone } from "$lib/components/common/feedback/StatusMessage/types";
import type { PrivilegedToolInformationKey } from "$lib/components/moderation/PrivilegedToolInformationSheet/types";
import type { PrivilegedWorkspaceGuideProps } from "$lib/components/moderation/PrivilegedWorkspaceGuide/types";

export type PrivilegedToolWorkspaceViewProps = {
	id: string;
	title: string;
	subtitle: string;
	informationKey: PrivilegedToolInformationKey;
	feedbackMessage?: string;
	feedbackTone?: StatusMessageTone;
	guide: PrivilegedWorkspaceGuideProps;
	onClose: () => void;
	children: Snippet;
};
