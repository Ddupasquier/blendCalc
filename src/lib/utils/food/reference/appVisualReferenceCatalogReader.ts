import type { Database } from "$lib/types/database.types";
import type {
	AppDelightMessage,
	AppReferenceCatalog,
	FoodSymbolRuleScope,
} from "$lib/utils/food/reference/appReferenceCatalog";
import type { SupabaseClient } from "@supabase/supabase-js";

type DatabaseQueryError = {
	code?: string;
	message?: string;
};

const SCHEMA_EXPANSION_ERROR_CODES = new Set([
	"42703",
	"42P01",
	"PGRST204",
	"PGRST205",
]);

export const isMissingAppVisualReferenceExpansion = (
	error: DatabaseQueryError | null | undefined,
	objectNames: readonly string[],
) => {
	if (!error?.code || !SCHEMA_EXPANSION_ERROR_CODES.has(error.code)) {
		return false;
	}
	const message = error.message?.toLowerCase() ?? "";
	return objectNames.some((objectName) =>
		message.includes(objectName.toLowerCase()),
	);
};

const readFoodSymbols = async (supabase: SupabaseClient<Database>) => {
	const currentResult = await supabase
		.from("food_symbol_definitions")
		.select("key, display_name, emoji, family_key, sort_order")
		.eq("enabled", true)
		.order("sort_order", { ascending: true });
	if (!currentResult.error) {
		return (currentResult.data ?? []).map((symbol) => ({
			key: symbol.key,
			label: symbol.display_name,
			emoji: symbol.emoji,
			familyKey: symbol.family_key,
		}));
	}
	if (
		!isMissingAppVisualReferenceExpansion(currentResult.error, ["family_key"])
	) {
		throw currentResult.error;
	}

	const legacyResult = await supabase
		.from("food_symbol_definitions")
		.select("key, display_name, emoji, sort_order")
		.eq("enabled", true)
		.order("sort_order", { ascending: true });
	if (legacyResult.error) throw legacyResult.error;
	return (legacyResult.data ?? []).map((symbol) => ({
		key: symbol.key,
		label: symbol.display_name,
		emoji: symbol.emoji,
		familyKey: symbol.key,
	}));
};

const readFoodSymbolResolutionRules = async (
	supabase: SupabaseClient<Database>,
) => {
	const currentResult = await supabase
		.from("food_symbol_category_rules")
		.select("symbol_key, match_pattern, priority, match_scopes")
		.eq("enabled", true)
		.order("priority", { ascending: true });
	if (!currentResult.error) {
		return (currentResult.data ?? []).map((rule) => ({
			symbolKey: rule.symbol_key,
			matchPattern: rule.match_pattern,
			priority: rule.priority,
			matchScopes: rule.match_scopes as FoodSymbolRuleScope[],
		}));
	}
	if (
		!isMissingAppVisualReferenceExpansion(currentResult.error, ["match_scopes"])
	) {
		throw currentResult.error;
	}

	const legacyResult = await supabase
		.from("food_symbol_category_rules")
		.select("symbol_key, match_pattern, priority")
		.eq("enabled", true)
		.order("priority", { ascending: true });
	if (legacyResult.error) throw legacyResult.error;
	return (legacyResult.data ?? []).map((rule) => ({
		symbolKey: rule.symbol_key,
		matchPattern: rule.match_pattern,
		priority: rule.priority,
		matchScopes: [
			"category",
			"uncategorized_name",
		] satisfies FoodSymbolRuleScope[],
	}));
};

const readDelightMessages = async (supabase: SupabaseClient<Database>) => {
	const mapDelightMessages = (
		rows: Array<{
			key: string;
			context_key: string;
			trigger_key: string;
			match_key: string | null;
			message: string;
			minimum_value: number | null;
			maximum_value: number | null;
			priority: number;
			tone?: string;
		}>,
	): AppDelightMessage[] =>
		rows.map((row) => ({
			key: row.key,
			contextKey: row.context_key as AppDelightMessage["contextKey"],
			triggerKey: row.trigger_key,
			matchKey: row.match_key,
			message: row.message,
			minimumValue:
				row.minimum_value === null ? null : Number(row.minimum_value),
			maximumValue:
				row.maximum_value === null ? null : Number(row.maximum_value),
			priority: row.priority,
			tone: row.tone === "cheeky" ? "cheeky" : "standard",
		}));
	const currentResult = await supabase
		.from("app_delight_messages")
		.select(
			"key, context_key, trigger_key, match_key, message, minimum_value, maximum_value, priority, tone",
		)
		.eq("enabled", true)
		.order("priority", { ascending: true })
		.order("key", { ascending: true });
	if (!currentResult.error) {
		return mapDelightMessages(currentResult.data ?? []);
	}
	if (
		isMissingAppVisualReferenceExpansion(currentResult.error, [
			"app_delight_messages",
			"tone",
		])
	) {
		if (currentResult.error.message?.toLowerCase().includes("tone")) {
			const legacyResult = await supabase
				.from("app_delight_messages")
				.select(
					"key, context_key, trigger_key, match_key, message, minimum_value, maximum_value, priority",
				)
				.eq("enabled", true)
				.order("priority", { ascending: true })
				.order("key", { ascending: true });
			if (legacyResult.error) throw legacyResult.error;
			return mapDelightMessages(legacyResult.data ?? []);
		}
		if (
			currentResult.error.message
				?.toLowerCase()
				.includes("app_delight_messages")
		) {
			return [];
		}
	}
	throw currentResult.error;
};

export const readAppVisualReferenceCatalog = async (
	supabase: SupabaseClient<Database>,
): Promise<
	Pick<
		AppReferenceCatalog,
		"foodSymbols" | "foodSymbolResolutionRules" | "delightMessages"
	>
> => {
	const [foodSymbols, foodSymbolResolutionRules, delightMessages] =
		await Promise.all([
			readFoodSymbols(supabase),
			readFoodSymbolResolutionRules(supabase),
			readDelightMessages(supabase),
		]);
	return { foodSymbols, foodSymbolResolutionRules, delightMessages };
};
