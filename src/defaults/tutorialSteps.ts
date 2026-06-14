export type TutorialStep = {
	title: string;
	description: string;
	points: string[];
	icon: "ingredients" | "goals" | "graph" | "save";
};

export const tutorialSteps: TutorialStep[] = [
	{
		title: "Build your ingredient lists",
		description: "Start with foods you actually use.",
		points: [
			"Search the food database or add a custom ingredient.",
			"Save foods to On Hand or Shopping List so they are easy to find later.",
		],
		icon: "ingredients",
	},
	{
		title: "Choose what you want to track",
		description: "Every smoothie can have its own nutrition targets.",
		points: [
			"Pick the nutrients that matter to you and enter a goal for each one.",
			"Select ingredients, then adjust their amounts to update the totals.",
		],
		icon: "goals",
	},
	{
		title: "Use the graph as a quick check",
		description: "The graph compares your current smoothie with your goals.",
		points: [
			"The light shape marks your goals. The colored shape moves with your ingredient amounts.",
			"Green means near goal, yellow means below goal, and red means over goal.",
			"Open suggestions when you want help adjusting the mix.",
		],
		icon: "graph",
	},
	{
		title: "Save a mix you want to make again",
		description: "Give a finished smoothie a name and keep it in Saved.",
		points: [
			"Load a saved mix whenever you want to reuse or adjust it.",
			"Changes do not overwrite the saved mix unless you choose to save them.",
		],
		icon: "save",
	},
];
