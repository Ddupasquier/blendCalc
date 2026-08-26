import { describe, expect, it } from "vitest";
import { parseCatalogDataOperationsHealth } from "$lib/utils/moderation/catalogDataOperationsHealth";
import { catalogDataOperationsHealthFixture } from "../../../fixtures/catalogDataOperationsHealth";

describe("moderator data-health parser", () => {
	it("accepts the bounded dashboard contract", () => {
		expect(
			parseCatalogDataOperationsHealth(catalogDataOperationsHealthFixture),
		).toEqual(catalogDataOperationsHealthFixture);
	});

	it("orders source activity by descending lookup usage with deterministic ties", () => {
		const usdaSource = catalogDataOperationsHealthFixture.sources[0];
		const openFoodFactsSource = {
			...usdaSource,
			key: "open-food-facts",
			displayName: "Open Food Facts",
			metrics: { ...usdaSource.metrics, lookups: 75 },
		};
		const colaSource = {
			...usdaSource,
			key: "cola-cloud",
			displayName: "COLA Cloud",
			metrics: { ...usdaSource.metrics, lookups: 20 },
		};
		const parsed = parseCatalogDataOperationsHealth({
			...catalogDataOperationsHealthFixture,
			sources: [usdaSource, colaSource, openFoodFactsSource],
		});

		expect(parsed.sources.map((source) => source.key)).toEqual([
			"open-food-facts",
			"cola-cloud",
			"usda-fdc",
		]);
	});

	it("rejects malformed aggregate values rather than inventing defaults", () => {
		expect(() =>
			parseCatalogDataOperationsHealth({
				...catalogDataOperationsHealthFixture,
				overview: {
					...catalogDataOperationsHealthFixture.overview,
					activeProducts: "16",
				},
			}),
		).toThrow(/overview\.activeProducts/u);
	});
});
