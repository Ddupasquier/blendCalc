import type { TutorialChoice } from "$lib/utils/tutorial/tutorial";

export type TutorialOverlayProps = {
	open?: boolean;
	mode?: "onboarding" | "replay";
	pathname: string;
	onNavigate: (href: string) => void | Promise<void>;
	onFinish: (choice: TutorialChoice) => boolean | Promise<boolean>;
};
