import { afterEach, describe, expect, it, vi } from "vitest";
import { readBlendCalcAPIV1SourceAttributionCatalog } from "$lib/server/blendCalcAPI/v1/blendCalcAPICatalog.server";
import type { Database } from "$lib/types/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

const sourceRows = [
	{
		key: "usda",
		display_name: "USDA FoodData Central",
		homepage_url: "https://fdc.nal.usda.gov/",
		terms_url: "https://fdc.nal.usda.gov/data-documentation.html",
		attribution_text: "USDA FoodData Central",
		canonical_license_name: "CC0-1.0",
		canonical_policy_reviewed_at: "2026-07-22T00:00:00.000Z",
		canonical_storage_allowed: true,
		api_redistribution_allowed: true,
	},
];

const createSupabase = () => {
	let sourceReads = 0;
	let datasetReads = 0;
	return {
		from: (table: string) => ({
			select: () => {
				if (table === "generic_food_datasets") {
					datasetReads += 1;
					return Promise.resolve(
						datasetReads === 1
							? { data: [], error: null }
							: { data: null, error: new Error("dataset outage") },
					);
				}
				return {
					eq: () => {
						sourceReads += 1;
						return Promise.resolve(
							sourceReads === 1
								? { data: sourceRows, error: null }
								: { data: null, error: new Error("source outage") },
						);
					},
				};
			},
		}),
	} as unknown as SupabaseClient<Database>;
};

describe("blendCalcAPI attribution resilience", () => {
	afterEach(() => vi.useRealTimers());

	it("reuses the last complete catalog during a transient refresh outage", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-08-28T00:00:00.000Z"));
		const supabase = createSupabase();
		const verified = await readBlendCalcAPIV1SourceAttributionCatalog(supabase);
		expect(verified.sources.usda?.licenseName).toBe("CC0-1.0");

		vi.advanceTimersByTime(5 * 60 * 1_000);
		await expect(
			readBlendCalcAPIV1SourceAttributionCatalog(supabase),
		).resolves.toBe(verified);
	});

	it("fails closed when the first attribution read is unavailable", async () => {
		const supabase = createSupabase();
		await readBlendCalcAPIV1SourceAttributionCatalog(supabase);
		const unavailableSupabase = {
			from: (table: string) => ({
				select: () =>
					table === "generic_food_datasets"
						? Promise.resolve({ data: null, error: new Error("outage") })
						: {
								eq: () =>
									Promise.resolve({ data: null, error: new Error("outage") }),
							},
			}),
		} as unknown as SupabaseClient<Database>;

		await expect(
			readBlendCalcAPIV1SourceAttributionCatalog(unavailableSupabase),
		).rejects.toThrow();
	});
});
