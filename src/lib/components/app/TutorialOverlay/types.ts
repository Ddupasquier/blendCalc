export type TutorialOverlayProps = {
	open?: boolean;
	mode?: "onboarding" | "replay";
	onFinish: () => boolean | Promise<boolean>;
};
