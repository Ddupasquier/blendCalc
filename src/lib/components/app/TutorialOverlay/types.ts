export type TutorialOverlayProps = {
	open?: boolean;
	onRemindLater: () => boolean | Promise<boolean>;
	onDontShowAgain: () => boolean | Promise<boolean>;
};
