export type TutorialOverlayProps = {
	open?: boolean;
	mode?: "onboarding" | "replay";
	pathname: string;
	onNavigate: (href: string) => void | Promise<void>;
	onFinish: () => boolean | Promise<boolean>;
};
