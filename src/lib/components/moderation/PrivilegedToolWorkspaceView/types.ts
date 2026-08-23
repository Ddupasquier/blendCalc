import type {
	ModerationWorkspaceForm,
	ModerationWorkspaceProps,
	ModerationWorkspaceScope,
} from "$lib/components/moderation/ModerationWorkspace/types";
import type { PrivilegedToolInformationKey } from "$lib/components/moderation/PrivilegedToolInformationSheet/types";

export type PrivilegedToolWorkspaceViewProps = {
	id: string;
	title: string;
	subtitle: string;
	informationKey: PrivilegedToolInformationKey;
	data: ModerationWorkspaceProps["data"];
	form?: ModerationWorkspaceForm;
	scope: Exclude<ModerationWorkspaceScope, "all">;
	onClose: () => void;
};
