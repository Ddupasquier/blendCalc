import type { TutorialStep } from "$lib/utils/tutorial/types";

export const tutorialSteps: TutorialStep[] = [
	{
		title: "Find the foods you use",
		description: "Search opens a focused list of catalog matches.",
		points: [
			"Search by food name, brand, or ingredient.",
			"Open a result for full nutrition details before adding it.",
		],
		icon: "ingredients",
		route: "/ingredients/fridge",
		target: "[data-tutorial-target='ingredient-search']",
		targetLabel: "ingredient search",
	},
	{
		title: "Scan packaged foods",
		description: "The barcode button looks up a package without typing its name.",
		points: [
			"Known details can be filled from the catalog and connected providers.",
			"Use the pencil beside it when you need to enter a food manually.",
		],
		icon: "ingredients",
		route: "/ingredients/fridge",
		target: "[data-tutorial-target='ingredient-barcode']",
		targetLabel: "barcode scanner",
	},
	{
		title: "Open one ingredient",
		description: "Each card represents one food in your Fridge or Shopping List.",
		points: [
			"Open the card for ingredients, allergens, servings, and complete nutrition details.",
			"An amber edge means the food may conflict with a dietary setting.",
		],
		icon: "ingredients",
		route: "/ingredients/fridge",
		target: "[data-tutorial-target='ingredient-card'] > .saved-ingredient-card",
		targetLabel: "one saved ingredient card",
	},
	{
		title: "Manage that ingredient",
		description: "The three-dot button keeps item-specific actions together.",
		points: [
			"The nearby arrow moves it between lists; this button opens select, rename, and remove actions.",
			"Moderator tools appear there only for accounts allowed to use them.",
		],
		icon: "ingredients",
		route: "/ingredients/fridge",
		target:
			"[data-tutorial-target='ingredient-card'] button[aria-label^='Open actions for']",
		targetLabel: "the ingredient actions button",
	},
	{
		title: "Choose what goes into Mix",
		description: "Select a food pill to add or remove that ingredient.",
		points: [
			"Mix uses foods already organized in your Fridge and Shopping List.",
			"Selected foods gain amount and serving controls farther down the page.",
		],
		icon: "ingredients",
		route: "/mix",
		target: "[data-tutorial-target='mix-ingredient-options'] .pill",
		targetLabel: "one Mix ingredient option",
	},
	{
		title: "Set one nutrition target",
		description: "Each goal input controls one point in the comparison chart.",
		points: [
			"Nutrition is calculated as the source value per 100g × selected grams ÷ 100.",
			"Missing source values stay unknown; blendCalc does not invent a number.",
		],
		icon: "goals",
		route: "/mix",
		target: "[data-tutorial-target='mix-goals'] .goal-input input",
		targetLabel: "one nutrient goal input",
	},
	{
		title: "Compare the result",
		description: "The chart updates when foods, amounts, or goals change.",
		points: [
			"The goal shape is your target; the result shape is the current Mix.",
			"Reaching 100% means reaching that target—not that a food is automatically healthy.",
		],
		icon: "graph",
		route: "/mix",
		target: "[data-tutorial-target='mix-result-chart']",
		targetLabel: "the Mix comparison chart",
	},
	{
		title: "Reopen a saved combination",
		description: "Each saved Mix stays compact until you choose to open it.",
		points: [
			"Open a row to review its ingredients, goals, and actions.",
			"Loading it creates an editable working Mix without silently overwriting the saved version.",
		],
		icon: "save",
		route: "/saved",
		target: "[data-tutorial-target='saved-recipe'] .saved-recipe-card summary",
		targetLabel: "one saved recipe",
	},
	{
		title: "Make warnings relevant to you",
		description: "Profile lets you save optional food-safety preferences.",
		points: [
			"Allergens and dietary restrictions can add warning edges and detailed notices.",
			"Warnings depend on available data; they are helpful prompts, not medical guarantees.",
		],
		icon: "goals",
		route: "/profile",
		target:
			"[data-tutorial-target='food-preferences'] .preference-editor-card:first-child",
		targetLabel: "one food-safety preference editor",
	},
];
