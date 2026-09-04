/**
 * Purpose: Normalize already-stored external ingredient statements without making
 * provider requests or changing user/moderator-authored values.
 * Preview: `node scripts/backfills/catalog/backfill_external_ingredient_statements.mjs`
 * Local apply: `node scripts/backfills/catalog/backfill_external_ingredient_statements.mjs --local --apply --confirm-apply=normalize-external-ingredients-v1`
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { isDeepStrictEqual } from "node:util";
import {
	EXTERNAL_INGREDIENT_NORMALIZATION_METHOD,
	EXTERNAL_INGREDIENT_NORMALIZATION_VERSION,
	normalizeExternalIngredientStatement,
} from "../../../src/lib/utils/food/ingredients/ingredientStatementNormalization.js";

const APPLY_CONFIRMATION = "normalize-external-ingredients-v1";
const EXTERNAL_SOURCES = new Set([
	"usda",
	"open-food-facts",
	"cola-cloud",
	"health-canada-cnf",
	"uk-cofid",
	"fsanz-afcd",
	"foodrepo",
]);
const SCOPES = [
	{
		key: "shared_product",
		table: "shared_products",
		select: "id, food, confidence, status, source, source_reference",
	},
	{ key: "custom_food", table: "custom_foods", select: "id, food" },
	{
		key: "user_food_list_item",
		table: "user_food_list_items",
		select: "id, food",
	},
];
const PAGE_SIZE = 200;

const args = new Set(process.argv.slice(2));
const isLocal = args.has("--local");
const isApply = args.has("--apply");
const scopeArgument = [...args].find((argument) =>
	argument.startsWith("--scope="),
);
const limitArgument = [...args].find((argument) =>
	argument.startsWith("--limit="),
);
const confirmationArgument = [...args].find((argument) =>
	argument.startsWith("--confirm-apply="),
);
const requestedScope = scopeArgument?.split("=")[1] ?? "all";
const limit = limitArgument
	? Number.parseInt(limitArgument.split("=")[1] ?? "", 10)
	: null;

if (isLocal) config({ path: ".env.test.local", quiet: true });
config({ path: ".env.moderation.local", quiet: true });
config({ path: ".env", quiet: true });

if (
	requestedScope !== "all" &&
	!SCOPES.some((scope) => scope.key === requestedScope)
) {
	throw new Error(`Unsupported --scope value: ${requestedScope}`);
}
if (limitArgument && (!Number.isSafeInteger(limit) || limit <= 0)) {
	throw new Error("--limit must be a positive integer.");
}
if (isApply && confirmationArgument?.split("=")[1] !== APPLY_CONFIRMATION) {
	throw new Error(
		`Apply requires --confirm-apply=${APPLY_CONFIRMATION}. Run the default preview first.`,
	);
}

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
	throw new Error(
		"PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
	);
}
if (
	isLocal &&
	!/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::|\/)/u.test(supabaseUrl)
) {
	throw new Error("--local refuses to use a non-local Supabase URL.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
	auth: {
		autoRefreshToken: false,
		detectSessionInUrl: false,
		persistSession: false,
	},
});

const isObject = (value) =>
	Boolean(value) && typeof value === "object" && !Array.isArray(value);

const uniqueStatements = (values) => {
	const seen = new Set();
	return values.flatMap((value) => {
		const text = String(value?.text ?? value ?? "").trim();
		const key = `${String(value?.type ?? "")}\u0000${text.toLocaleLowerCase("en-US")}`;
		if (!text || seen.has(key)) return [];
		seen.add(key);
		return [value];
	});
};

export const buildNormalizedExternalIngredientFood = (
	food,
	fallbackIngredientSource,
	fallbackSourceReference,
) => {
	if (!isObject(food) || typeof food.ingredients !== "string") return null;
	const ingredientSource =
		food.fieldProvenance?.ingredients?.source ?? fallbackIngredientSource;
	if (!EXTERNAL_SOURCES.has(ingredientSource)) return null;
	const isCurrentNormalization =
		food.ingredientAnalysis?.normalization?.method ===
			EXTERNAL_INGREDIENT_NORMALIZATION_METHOD &&
		food.ingredientAnalysis?.normalization?.version ===
			EXTERNAL_INGREDIENT_NORMALIZATION_VERSION;
	if (isCurrentNormalization) {
		if (food.fieldProvenance?.ingredients?.source === ingredientSource) {
			return null;
		}
		return {
			...food,
			fieldProvenance: {
				...(isObject(food.fieldProvenance) ? food.fieldProvenance : {}),
				ingredients: {
					source: ingredientSource,
					...(fallbackSourceReference
						? { sourceReference: fallbackSourceReference }
						: {}),
				},
			},
		};
	}
	const languageCode =
		food.ingredientAnalysis?.normalization?.languageCode ??
		food.sourceMetadata?.language ??
		(ingredientSource === "usda" ? "en" : undefined);
	const normalized = normalizeExternalIngredientStatement(food.ingredients, {
		languageCode,
		sourceField:
			food.ingredientAnalysis?.normalization?.sourceField ?? "ingredients",
	});
	if (!normalized.ingredientText) return null;

	const existingAnalysis = isObject(food.ingredientAnalysis)
		? food.ingredientAnalysis
		: {};
	const ingredientAnalysis = {
		...existingAnalysis,
		ingredientTags: Array.isArray(existingAnalysis.ingredientTags)
			? existingAnalysis.ingredientTags
			: [],
		analysisTags: Array.isArray(existingAnalysis.analysisTags)
			? existingAnalysis.analysisTags
			: [],
		derivedTraceTags: Array.isArray(existingAnalysis.derivedTraceTags)
			? existingAnalysis.derivedTraceTags
			: [],
		normalization: normalized.normalization,
		allergenDeclarationAnalysis: normalized.declarationAnalysis,
	};
	const derivedPrecautionaryStatements = normalized.precautionaryStatements.map(
		(statement) => ({
			...statement,
			languageCode: normalized.declarationAnalysis.languageCode,
			sourceField: normalized.declarationAnalysis.sourceField,
		}),
	);
	const existingPrecautionaryStatements = Array.isArray(
		food.precautionaryStatements,
	)
		? food.precautionaryStatements
		: [];
	const precautionaryStatements = uniqueStatements([
		...derivedPrecautionaryStatements,
		...existingPrecautionaryStatements,
	]);
	const nextFood = {
		...food,
		ingredients: normalized.ingredientText,
		ingredientList: normalized.ingredientList,
		ingredientAnalysis,
		fieldProvenance: {
			...(isObject(food.fieldProvenance) ? food.fieldProvenance : {}),
			ingredients: {
				...(isObject(food.fieldProvenance?.ingredients)
					? food.fieldProvenance.ingredients
					: {}),
				source: ingredientSource,
				...(fallbackSourceReference &&
				!food.fieldProvenance?.ingredients?.sourceReference
					? { sourceReference: fallbackSourceReference }
					: {}),
			},
		},
		...(precautionaryStatements.length > 0
			? { precautionaryStatements }
			: { precautionaryStatements: undefined }),
	};
	if (nextFood.precautionaryStatements === undefined) {
		delete nextFood.precautionaryStatements;
	}
	return isDeepStrictEqual(nextFood, food) ? null : nextFood;
};

const buildStableNormalizedExternalIngredientFood = (
	food,
	fallbackIngredientSource,
	fallbackSourceReference,
) => {
	let candidate = food;
	let changed = false;
	for (let pass = 0; pass < 3; pass += 1) {
		const next = buildNormalizedExternalIngredientFood(
			candidate,
			fallbackIngredientSource,
			fallbackSourceReference,
		);
		if (!next) return changed ? candidate : null;
		candidate = next;
		changed = true;
	}
	throw new Error(
		"Ingredient normalization did not stabilize within three passes.",
	);
};

const counters = {
	scanned: 0,
	eligible: 0,
	changed: 0,
	skippedReviewed: 0,
	failed: 0,
};

const selectedScopes = SCOPES.filter(
	(scope) => requestedScope === "all" || requestedScope === scope.key,
);

for (const scope of selectedScopes) {
	let offset = 0;
	while (limit === null || counters.scanned < limit) {
		const remaining = limit === null ? PAGE_SIZE : limit - counters.scanned;
		if (remaining <= 0) break;
		const pageSize = Math.min(PAGE_SIZE, remaining);
		const { data, error } = await supabase
			.from(scope.table)
			.select(scope.select)
			.range(offset, offset + pageSize - 1)
			.order("id", { ascending: true });
		if (error) throw error;
		if (!data?.length) break;

		for (const row of data) {
			counters.scanned += 1;
			if (
				scope.key === "shared_product" &&
				(row.status !== "active" || row.confidence === "moderator-reviewed")
			) {
				counters.skippedReviewed += 1;
				continue;
			}
			const normalizedFood = buildStableNormalizedExternalIngredientFood(
				row.food,
				scope.key === "shared_product" ? row.source : undefined,
				scope.key === "shared_product" ? row.source_reference : undefined,
			);
			if (!normalizedFood) continue;
			counters.eligible += 1;
			if (!isApply) continue;

			const { data: result, error: applyError } = await supabase.rpc(
				"apply_external_ingredient_statement_normalization",
				{
					p_scope: scope.key,
					p_row_id: row.id,
					p_expected_food: row.food,
					p_normalized_food: normalizedFood,
				},
			);
			if (applyError) {
				counters.failed += 1;
				continue;
			}
			if (result === "updated") counters.changed += 1;
		}

		if (data.length < pageSize) break;
		offset += data.length;
	}
}

console.log(
	JSON.stringify({
		mode: isApply ? "apply" : "preview",
		scope: requestedScope,
		...counters,
	}),
);

if (counters.failed > 0) process.exitCode = 1;
