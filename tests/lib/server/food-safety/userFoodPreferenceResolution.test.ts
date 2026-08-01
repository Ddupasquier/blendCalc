import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "$lib/types/database.types";
import {
	getUserFoodPreferenceResolutions,
} from "$lib/server/food-safety/userFoodPreferenceResolution.server";

describe("user food preference resolution loader", () => {
	it("returns exact server-owned resolution evidence", async () => {
		const data = [{
			raw_value: "Banana sensitivity",
			normalized_value: "banana sensitivity",
			rule_type: "allergen",
			resolution_status: "resolved",
			resolution_method: "ingredient_alias",
			resolution_policy_version_id: "policy-1",
			resolution_language_code: "en",
			ingredient_term_id: "term-1",
			ingredient_alias_id: "alias-1",
			preference_term_mapping_id: "mapping-1",
			tag: {
				id: "tag-1",
				slug: "banana-fixture",
				label: "Banana fixture",
				category: "allergen",
			},
		}];
		const query = {
			eq: vi.fn(),
			order: vi.fn(),
		};
		query.eq.mockReturnValue(query);
		query.order
			.mockReturnValueOnce(query)
			.mockResolvedValueOnce({ data, error: null });
		const select = vi.fn(() => query);
		const supabase = {
			from: vi.fn(() => ({ select })),
		} as unknown as SupabaseClient<Database>;

		await expect(
			getUserFoodPreferenceResolutions(supabase, "user-1"),
		).resolves.toEqual([{
			rawValue: "Banana sensitivity",
			normalizedValue: "banana sensitivity",
			ruleType: "allergen",
			status: "resolved",
			method: "ingredient_alias",
			policyVersionId: "policy-1",
			languageCode: "en",
			ingredientTermId: "term-1",
			ingredientAliasId: "alias-1",
			preferenceTermMappingId: "mapping-1",
			tag: {
				id: "tag-1",
				slug: "banana-fixture",
				label: "Banana fixture",
				category: "allergen",
			},
		}]);
		expect(select).toHaveBeenCalledWith(expect.stringContaining(
			"resolution_status",
		));
	});
});
