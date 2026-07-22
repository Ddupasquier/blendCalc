export type TutorialStepIconName = "ingredients" | "goals" | "graph" | "save";

export type TutorialStep = {
	title: string;
	description: string;
	points: string[];
	icon: TutorialStepIconName;
};
