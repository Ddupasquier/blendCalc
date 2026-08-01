/**
 * Purpose: Define deterministic local-only QA personas, catalog identities, saved
 * mixes, and profile states for `scripts/operations/manage_test_database.mjs`.
 * Do not run directly. Reset the isolated stack
 * with `npm run db:test:reset` to recreate the exact states below.
 */

export const localQaPassword = "BlendCalc-Local-QA-2026!";

export const localQaSavedDrinks = {
	morningGreen: {
		name: "QA Morning Green",
		createdAt: "2026-07-20T12:00:00.000Z",
		ingredients: [
			["09000000000025", 118],
			["09000000000018", 30],
			["09000000000032", 170],
			["09000000000049", 28],
			["09000000000056", 100],
			["09000000000063", 240],
			["09000000000070", 10],
			["09000000000087", 100],
			["09000000000094", 100],
			["09000000000100", 5],
		],
		goals: { 1008: 350, 1003: 20, 1079: 10, 1005: 60, 1004: 20 },
	},
	berryRepeat: {
		name: "QA Berry Repeat",
		createdAt: "2026-07-21T12:00:00.000Z",
		ingredients: [
			["09000000000117", 100],
			["09000000000032", 170],
		],
		goals: { 1008: 300, 1003: 20, 1079: 8, 1005: 45, 1004: 15 },
	},
	exportBerry: {
		name: "QA Export Berry Mix",
		createdAt: "2026-07-22T12:00:00.000Z",
		ingredients: [
			["09000000000117", 100],
			["09000000000032", 170],
		],
		goals: { 1008: 300, 1003: 20, 1079: 8, 1005: 45, 1004: 15 },
	},
	serverLoad: {
		name: "QA Server Load",
		createdAt: "2026-07-23T12:00:00.000Z",
		ingredients: [
			["00021130493609", 125],
			["09000000000155", 62],
		],
		goals: { 1008: 250, 1003: 12, 1079: 8, 1005: 40, 1004: 15 },
	},
};

const populatedLists = {
	fridge: [
		"00021130462506",
		"00021130493609",
		"08801005523455",
		"09000000000018",
		"09000000000025",
		"09000000000032",
		"09000000000049",
		"09000000000056",
		"09000000000063",
		"09000000000070",
		"09000000000087",
		"09000000000094",
		"09000000000100",
		"09000000000124",
		"09000000000131",
	],
	shopping: [
		"00869759000149",
		"00011110904416",
		"09000000000155",
		"09000000000162",
	],
};

const warningLists = {
	fridge: [
		"08801005523455",
		"09000000000124",
		"09000000000131",
		"09000000000032",
	],
	shopping: [
		"00869759000149",
		"09000000000063",
		"09000000000148",
	],
};

const tourLists = {
	fridge: localQaSavedDrinks.morningGreen.ingredients.map(([barcode]) => barcode),
	shopping: [],
};

const roleLists = {
	fridge: ["00021130462506", "00021130493609", "08801005523455"],
	shopping: ["00869759000149", "00011110904416", "09000000000162"],
};

export const localQaPersonas = [
	{
		key: "user",
		purpose: "Populated everyday state across Ingredients, Mix, and Saved",
		email: "qa-user@blendcalc.local",
		displayName: "QA User",
		role: "user",
		tutorialState: "completed",
		lists: populatedLists,
		savedDrinkKeys: ["morningGreen", "berryRepeat", "exportBerry", "serverLoad"],
		activeMixKey: "morningGreen",
		preferences: {
			unit_system: "us",
			allergens: [],
			dietary_restrictions: [],
			prioritized_nutrient_ids: [1008, 1003, 1079],
			default_smoothie_serving_grams: 350,
			regulatory_region_code: "US",
			regulatory_region_source: "account",
		},
	},
	{
		key: "preferences",
		purpose: "Food-warning coverage for vegan, gluten, peanut, and shellfish rules",
		email: "qa-preferences@blendcalc.local",
		displayName: "QA Food Warnings",
		role: "user",
		tutorialState: "completed",
		lists: warningLists,
		savedDrinkKeys: ["serverLoad"],
		activeMixKey: null,
		preferences: {
			unit_system: "us",
			allergens: ["peanut", "shellfish"],
			dietary_restrictions: ["vegan", "gluten-free"],
			prioritized_nutrient_ids: [1008, 1003, 1079],
			default_smoothie_serving_grams: 350,
			regulatory_region_code: "US",
			regulatory_region_source: "account",
		},
	},
	{
		key: "empty",
		purpose: "Authenticated empty states without onboarding interruption",
		email: "qa-empty@blendcalc.local",
		displayName: "QA Empty State",
		role: "user",
		tutorialState: "completed",
		lists: { fridge: [], shopping: [] },
		savedDrinkKeys: [],
		activeMixKey: null,
		preferences: null,
	},
	{
		key: "onboarding",
		purpose: "Guided-tour state with every required highlighted target",
		email: "qa-onboarding@blendcalc.local",
		displayName: "QA Guided Tour",
		role: "user",
		tutorialState: "pending",
		lists: tourLists,
		savedDrinkKeys: ["morningGreen"],
		activeMixKey: "morningGreen",
		preferences: null,
	},
	{
		key: "moderator",
		purpose: "Moderator access with populated catalog-review data",
		email: "qa-moderator@blendcalc.local",
		displayName: "QA Moderator",
		role: "moderator",
		tutorialState: "completed",
		lists: roleLists,
		savedDrinkKeys: ["serverLoad"],
		activeMixKey: null,
		preferences: null,
	},
	{
		key: "admin",
		purpose: "Admin access with populated catalog and data-health views",
		email: "qa-admin@blendcalc.local",
		displayName: "QA Admin",
		role: "admin",
		tutorialState: "completed",
		lists: roleLists,
		savedDrinkKeys: ["serverLoad"],
		activeMixKey: null,
		preferences: null,
	},
].map((persona) => ({ ...persona, password: localQaPassword }));

export const getLocalQaCatalogBarcodes = () => [
	...new Set(localQaPersonas.flatMap((persona) => [
		...persona.lists.fridge,
		...persona.lists.shopping,
		...persona.savedDrinkKeys.flatMap((key) =>
			localQaSavedDrinks[key].ingredients.map(([barcode]) => barcode),
		),
	])),
];
