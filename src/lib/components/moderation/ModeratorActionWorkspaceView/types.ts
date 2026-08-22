import type {
	ModerationWorkspaceForm,
	ModerationWorkspaceProps,
	ModerationWorkspaceScope,
} from "$lib/components/moderation/ModerationWorkspace/types";
import type { ModeratorActionInformationKey } from "$lib/components/moderation/ModeratorActionInformationSheet/types";

export type ModeratorActionWorkspaceViewProps = {
	id: string;
	title: string;
	subtitle: string;
	informationKey: ModeratorActionInformationKey;
	data: ModerationWorkspaceProps["data"];
	form?: ModerationWorkspaceForm;
	scope: Exclude<ModerationWorkspaceScope, "all">;
	onClose: () => void;
};
