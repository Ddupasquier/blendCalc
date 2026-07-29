import type {
	FoodCompatibilityFact,
	FoodCompatibilitySummary,
} from "$lib/utils/food/quality/compatibility";
import type { FdcFood } from "$lib/utils/food/types";

type RegressionPreference = {
	allergens?: string[];
	dietaryRestrictions?: string[];
};

export type FoodCompatibilityRegressionCase = {
	name: string;
	food: FdcFood;
	preferences: RegressionPreference;
	expectedWarningLabels: string[];
	expectedIssueCodes?: string[];
};

const createFact = (
	slug: string,
	label: string,
	options: Partial<FoodCompatibilityFact> = {},
): FoodCompatibilityFact => ({
	slug,
	label,
	category: "avoidance",
	factType: "ingredient_present",
	sourceType: "label_ingredient_field",
	sourceText: label,
	confidence: "confirmed",
	...options,
});

const createSummary = (
	facts: FoodCompatibilityFact[],
): FoodCompatibilitySummary => ({
	version: 1,
	policyVersion: 1,
	generatedAt: "2026-07-29T00:00:00.000Z",
	allFacts: facts,
	contains: facts.filter((fact) => fact.factType === "contains"),
	mayContain: facts.filter((fact) => fact.factType === "may_contain"),
	dietaryClaims: facts.filter((fact) => fact.factType === "dietary_claim"),
	ingredientSignals: facts.filter(
		(fact) => fact.factType === "ingredient_present",
	),
});

const createFood = (
	description: string,
	barcode: string | null,
	facts: FoodCompatibilityFact[],
): FdcFood => ({
	fdcId: Number(barcode?.slice(-8) ?? 1),
	description,
	barcode: barcode ?? undefined,
	foodNutrients: [],
	compatibilitySummary: createSummary(facts),
});

const contains = (
	slug: string,
	label: string,
): FoodCompatibilityFact => createFact(slug, label, {
	category: "allergen",
	factType: "contains",
	sourceType: "label_allergen_field",
});

const mayContain = (
	slug: string,
	label: string,
): FoodCompatibilityFact => createFact(slug, label, {
	category: "allergen",
	factType: "may_contain",
	sourceType: "label_trace_field",
	confidence: "uncertain",
});

const intrinsic = (
	slug: string,
	label: string,
): FoodCompatibilityFact => createFact(slug, label, {
	category: "allergen",
	factType: "contains",
	sourceType: "food_identity_taxonomy",
});

export const FOOD_COMPATIBILITY_REGRESSION_CORPUS:
	FoodCompatibilityRegressionCase[] = [
	{
		name: "Sempio Gochu Jang warns from label evidence",
		food: createFood("Sempio, Gochu Jang Hot & Sweet Chili Sauce", "08801005523455", [
			contains("soy", "Soy"),
			contains("wheat", "Wheat"),
		]),
		preferences: { allergens: ["Soy"], dietaryRestrictions: ["Gluten-free"] },
		expectedWarningLabels: ["Soy", "Gluten-free"],
	},
	{
		name: "GTIN-14 fixture retains explicit contains and trace evidence",
		food: createFood("Chocolate confection", "05000159461122", [
			contains("egg", "Egg"),
			contains("milk", "Milk"),
			contains("peanut", "Peanut"),
			contains("soy", "Soy"),
			mayContain("tree-nut", "Tree Nut"),
		]),
		preferences: { allergens: ["Egg", "Milk", "Peanut", "Soy", "Tree Nut"] },
		expectedWarningLabels: ["Egg", "Milk", "Peanut", "Soy", "Tree Nut"],
		expectedIssueCodes: [
			"FOOD_ALLERGEN_CONTAINS",
			"FOOD_ALLERGEN_MAY_CONTAIN",
		],
	},
	{
		name: "Nutella uses explicit milk, tree-nut, and soy evidence",
		food: createFood("Nutella", "03017620422003", [
			contains("milk", "Milk"),
			contains("tree-nut", "Tree Nut"),
			contains("soy", "Soy"),
		]),
		preferences: { allergens: ["Milk", "Tree Nut", "Soy"] },
		expectedWarningLabels: ["Milk", "Tree Nut", "Soy"],
	},
	{
		name: "Trader Joe's Peanut Butter uses peanut evidence",
		food: createFood("Trader Joe's Peanut Butter", "00000000119993", [
			contains("peanut", "Peanut"),
		]),
		preferences: { allergens: ["Peanut"] },
		expectedWarningLabels: ["Peanut"],
	},
	{
		name: "Database-backed peanut butter category never substitutes for evidence",
		food: createFood("Peanut Butter", "00869759000149", []),
		preferences: { allergens: ["Peanut"] },
		expectedWarningLabels: [],
	},
	{
		name: "Pasta sauce name does not invent allergens",
		food: createFood(
			"Roasted Onion & Garlic Pasta Sauce, Roasted Onion & Garlic",
			"00021130493609",
			[],
		),
		preferences: { allergens: ["Milk", "Soy", "Wheat"] },
		expectedWarningLabels: [],
	},
	{
		name: "Strawberry jelly name does not invent fruit or allergen evidence",
		food: createFood("Strawberry Jelly, Strawberry", "00021130462506", []),
		preferences: { allergens: ["Milk", "Peanut"], dietaryRestrictions: ["Vegan"] },
		expectedWarningLabels: [],
	},
	{
		name: "Alabama White Sauce without evidence remains unknown",
		food: createFood("Alabama White Sauce", "00051497279929", []),
		preferences: { allergens: ["Egg", "Milk"] },
		expectedWarningLabels: [],
	},
	{
		name: "Protein bar title does not imply milk",
		food: createFood("Chocolate Dough Protein Bar", "00850000487260", []),
		preferences: { allergens: ["Milk"] },
		expectedWarningLabels: [],
	},
	{
		name: "Caramel rice crisp title does not imply milk",
		food: createFood("Caramel Rice Crisps", "00030000581728", []),
		preferences: { allergens: ["Milk"] },
		expectedWarningLabels: [],
	},
	{
		name: "Agave syrup title does not imply vegan compatibility",
		food: createFood("Blue Agave Light Golden Syrup", "00011110904416", []),
		preferences: { dietaryRestrictions: ["Vegan"] },
		expectedWarningLabels: [],
	},
	{
		name: "Generic beef conflicts with vegan and vegetarian preferences",
		food: createFood("Beef, Ground, Raw", null, [
			createFact("meat", "Meat", {
				factType: "dietary_conflict",
				sourceType: "food_identity_taxonomy",
			}),
		]),
		preferences: { dietaryRestrictions: ["Vegan", "Vegetarian"] },
		expectedWarningLabels: ["Vegan", "Vegetarian"],
	},
	{
		name: "Generic pork conflicts with kosher and halal preferences",
		food: createFood("Pork, Fresh, Ground, Raw", null, [
			createFact("pork", "Pork", {
				factType: "dietary_conflict",
				sourceType: "food_identity_taxonomy",
			}),
		]),
		preferences: { dietaryRestrictions: ["Kosher", "Halal"] },
		expectedWarningLabels: ["Kosher", "Halal"],
	},
	{
		name: "Generic chicken conflicts with vegan and vegetarian preferences",
		food: createFood("Chicken, Broilers or Fryers, Meat Only, Raw", null, [
			createFact("meat", "Meat", {
				factType: "dietary_conflict",
				sourceType: "food_identity_taxonomy",
			}),
		]),
		preferences: { dietaryRestrictions: ["Vegan", "Vegetarian"] },
		expectedWarningLabels: ["Vegan", "Vegetarian"],
	},
	{
		name: "Generic shrimp is an intrinsic shellfish allergen",
		food: createFood("Crustaceans, Shrimp, Mixed Species, Raw", null, [
			intrinsic("shellfish", "Shellfish"),
		]),
		preferences: { allergens: ["Shellfish"] },
		expectedWarningLabels: ["Shellfish"],
		expectedIssueCodes: ["FOOD_INTRINSIC_ALLERGEN"],
	},
	{
		name: "Generic mussels are an intrinsic mollusc allergen",
		food: createFood("Mollusks, Mussel, Blue, Raw", null, [
			intrinsic("mollusc", "Mollusc"),
		]),
		preferences: { allergens: ["Mollusc"] },
		expectedWarningLabels: ["Mollusc"],
		expectedIssueCodes: ["FOOD_INTRINSIC_ALLERGEN"],
	},
	{
		name: "Generic salmon is an intrinsic fish allergen",
		food: createFood("Fish, Salmon, Atlantic, Wild, Raw", null, [
			intrinsic("fish", "Fish"),
		]),
		preferences: { allergens: ["Fish"] },
		expectedWarningLabels: ["Fish"],
		expectedIssueCodes: ["FOOD_INTRINSIC_ALLERGEN"],
	},
	{
		name: "Generic egg is an intrinsic egg allergen",
		food: createFood("Egg, Whole, Raw, Fresh", null, [
			intrinsic("egg", "Egg"),
		]),
		preferences: { allergens: ["Egg"] },
		expectedWarningLabels: ["Egg"],
	},
	{
		name: "Generic milk is an intrinsic milk allergen",
		food: createFood("Milk, Whole, 3.25% Milkfat", null, [
			intrinsic("milk", "Milk"),
		]),
		preferences: { allergens: ["Milk"] },
		expectedWarningLabels: ["Milk"],
	},
	{
		name: "Honey conflicts with vegan preference from bee-product evidence",
		food: createFood("Honey", null, [
			createFact("bee-product", "Bee-derived ingredient", {
				factType: "dietary_conflict",
				sourceType: "food_identity_taxonomy",
			}),
		]),
		preferences: { dietaryRestrictions: ["Vegan"] },
		expectedWarningLabels: ["Vegan"],
	},
	{
		name: "Gelatin conflicts with vegan, vegetarian, halal, and kosher",
		food: createFood("Gelatin, Dry Powder, Unsweetened", null, [
			createFact("gelatin", "Gelatin", {
				factType: "dietary_conflict",
				sourceType: "food_identity_taxonomy",
			}),
		]),
		preferences: {
			dietaryRestrictions: ["Vegan", "Vegetarian", "Halal", "Kosher"],
		},
		expectedWarningLabels: ["Vegan", "Vegetarian", "Halal", "Kosher"],
	},
	{
		name: "Wine conflicts with alcohol-avoiding dietary policies",
		food: createFood("Wine, Table, Red", null, [
			createFact("alcohol", "Alcohol", {
				factType: "dietary_conflict",
				sourceType: "food_identity_taxonomy",
			}),
		]),
		preferences: { dietaryRestrictions: ["Halal"] },
		expectedWarningLabels: ["Halal"],
	},
	{
		name: "Tofu conflicts with soy allergy from intrinsic evidence",
		food: createFood("Tofu, Raw, Regular", null, [
			intrinsic("soy", "Soy"),
		]),
		preferences: { allergens: ["Soy"] },
		expectedWarningLabels: ["Soy"],
	},
	{
		name: "Wheat bread conflicts with wheat allergy and gluten-free preference",
		food: createFood("Bread, Wheat", null, [
			intrinsic("wheat", "Wheat"),
			createFact("gluten", "Gluten", {
				category: "allergen",
				sourceType: "food_identity_taxonomy",
			}),
		]),
		preferences: {
			allergens: ["Wheat"],
			dietaryRestrictions: ["Gluten-free"],
		},
		expectedWarningLabels: ["Wheat", "Gluten-free"],
	},
	{
		name: "Plant milk exclusion does not carry a dairy fact",
		food: createFood("Beverage, Almond Milk, Unsweetened", null, [
			intrinsic("tree-nut", "Tree Nut"),
		]),
		preferences: { allergens: ["Milk", "Tree Nut"] },
		expectedWarningLabels: ["Tree Nut"],
	},
	{
		name: "Eggplant does not carry an egg fact",
		food: createFood("Eggplant, Raw", null, []),
		preferences: { allergens: ["Egg"] },
		expectedWarningLabels: [],
	},
	{
		name: "A may-contain declaration stays potential",
		food: createFood("Chocolate Wafer", null, [
			mayContain("peanut", "Peanut"),
		]),
		preferences: { allergens: ["Peanut"] },
		expectedWarningLabels: ["Peanut"],
		expectedIssueCodes: ["FOOD_ALLERGEN_MAY_CONTAIN"],
	},
	{
		name: "A vegan source claim does not override meat evidence",
		food: createFood("Prepared Entrée", null, [
			createFact("vegan", "Vegan", {
				category: "dietary",
				factType: "dietary_claim",
				sourceType: "label_dietary_field",
			}),
			createFact("meat", "Meat"),
		]),
		preferences: { dietaryRestrictions: ["Vegan"] },
		expectedWarningLabels: ["Vegan"],
	},
];
