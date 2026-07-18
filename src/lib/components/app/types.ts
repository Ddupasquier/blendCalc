export type AppHeaderProps = {
	displayName: string;
	avatarUrl?: string | null;
	avatarAltText?: string | null;
	role?: string | null;
};

export type TutorialStepIconName = "ingredients" | "goals" | "graph" | "save";

export type TutorialStepIconProps = {
	name: TutorialStepIconName;
};
