import type {
	ModerationWorkspaceForm,
	ModerationWorkspaceProps,
	ModerationWorkspaceScope,
} from "$lib/components/moderation/ModerationWorkspace/types";

export type ModeratorActionWorkspaceViewProps = {
	id: string;
	title: string;
	subtitle: string;
	data: ModerationWorkspaceProps["data"];
	form?: ModerationWorkspaceForm;
	scope: Exclude<ModerationWorkspaceScope, "all">;
	onClose: () => void;
};
