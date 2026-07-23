import { describe, expect, it } from "vitest";
import { searchGenericFoods } from "$lib/server/products/genericFoods.server";
import type { Database } from "$lib/types/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

const createClient = (row: Record<string, unknown>) => ({
	rpc: async () => ({ data: [row], error: null }),
}) as unknown as SupabaseClient<Database>;

describe("generic food search", () => {
	it("preserves dataset licence and attribution metadata in API-ready results", async () => {
		const foods = await searchGenericFoods(createClient({
			application_food_id: -123,
			dataset_key: "cnf-2026",
			source_food_key: "101",
			description: "Blueberries, raw",
			food_group_name: "Fruits and fruit juices",
			external_reference: null,
			source_updated_at: "2026-05-14",
			source_key: "health-canada-cnf",
			source_display_name: "Health Canada Canadian Nutrient File",
			dataset_display_name: "Canadian Nutrient File 2026",
			dataset_version: "2026",
			source_url: "https://open.canada.ca/data/en/dataset/1b6139bd-ed7e-4043-bc28-ff00e10f3109",
			license_name: "Open Government Licence – Canada",
			license_url: "https://open.canada.ca/en/open-government-licence-canada",
			attribution_text: "Contains information licensed under the Open Government Licence – Canada.",
			metadata: {},
			nutrients: [],
			measures: [],
		}), "blueberries");

		expect(foods[0]?.sourceAttribution).toEqual({
			datasetKey: "cnf-2026",
			datasetName: "Canadian Nutrient File 2026",
			datasetVersion: "2026",
			sourceName: "Health Canada Canadian Nutrient File",
			sourceUrl: "https://open.canada.ca/data/en/dataset/1b6139bd-ed7e-4043-bc28-ff00e10f3109",
			licenseName: "Open Government Licence – Canada",
			licenseUrl: "https://open.canada.ca/en/open-government-licence-canada",
			attributionText: "Contains information licensed under the Open Government Licence – Canada.",
		});
	});
});
