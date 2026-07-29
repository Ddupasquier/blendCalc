export type TutorialStepIconName = "ingredients" | "goals" | "graph" | "save";

export type TutorialStep = {
	title: string;
	description: string;
	points: string[];
	icon: TutorialStepIconName;
	route: "/fridge" | "/mix" | "/saved" | "/profile";
	target: string;
	targetLabel: string;
};

export type TutorialViewport = {
	width: number;
	height: number;
};

export type TutorialRect = {
	top: number;
	right: number;
	bottom: number;
	left: number;
	width: number;
	height: number;
};

export type TutorialCornerRadius = {
	horizontal: number;
	vertical: number;
};

export type TutorialCornerRadii = {
	topLeft: TutorialCornerRadius;
	topRight: TutorialCornerRadius;
	bottomRight: TutorialCornerRadius;
	bottomLeft: TutorialCornerRadius;
};

export type TutorialSize = {
	width: number;
	height: number;
};

export type TutorialPosition = {
	top: number;
	left: number;
};
