export type TutorialStepIconName = "ingredients" | "goals" | "graph" | "save";

export type TutorialTargetId =
	| "ingredient-search"
	| "ingredient-barcode"
	| "ingredient-card"
	| "ingredient-actions"
	| "mix-ingredient-option"
	| "mix-goal-input"
	| "mix-result-chart"
	| "saved-recipe"
	| "food-preference-search";

export type TutorialRevealId =
	| "mix-add-ingredients"
	| "mix-goals"
	| "mix-nutrient-shape"
	| "profile-allergens";

export type TutorialStep = {
	title: string;
	description: string;
	points: string[];
	icon: TutorialStepIconName;
	route:
		"/ingredients/fridge" | "/mix" | "/saved" | "/profile/food-preferences";
	targetId: TutorialTargetId;
	revealId?: TutorialRevealId;
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
