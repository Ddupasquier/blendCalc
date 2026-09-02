export const FRIDGE_FIELD_P75_BUDGETS_MS = {
	firstContentfulPaint: 2_500,
	largestContentfulPaint: 2_500,
	interactionToNextPaint: 200,
	timeToFirstByte: 800,
} as const;

export const FRIDGE_DIAGNOSTIC_BUDGETS_MS = {
	auth: 800,
	rootProfile: 1_000,
	rootReference: 1_000,
	ingredients: 1_500,
	totalServer: 3_000,
	hydration: 3_500,
	loadMore: 200,
} as const;
