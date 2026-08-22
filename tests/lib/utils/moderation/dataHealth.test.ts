import { describe, expect, it } from "vitest";
import { parseModeratorDataHealth } from "$lib/utils/moderation/dataHealth";
import { moderatorDataHealthFixture } from "../../../fixtures/moderatorDataHealth";

describe("moderator data-health parser", () => {
	it("accepts the bounded dashboard contract", () => {
		expect(parseModeratorDataHealth(moderatorDataHealthFixture))
			.toEqual(moderatorDataHealthFixture);
	});

	it("orders source activity by descending lookup usage with deterministic ties", () => {
		const usdaSource = moderatorDataHealthFixture.sources[0];
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
		const parsed = parseModeratorDataHealth({
			...moderatorDataHealthFixture,
			sources: [usdaSource, colaSource, openFoodFactsSource],
		});

		expect(parsed.sources.map((source) => source.key)).toEqual([
			"open-food-facts",
			"cola-cloud",
			"usda-fdc",
		]);
	});

	it("rejects malformed aggregate values rather than inventing defaults", () => {
		expect(() => parseModeratorDataHealth({
			...moderatorDataHealthFixture,
			overview: {
				...moderatorDataHealthFixture.overview,
				activeProducts: "16",
			},
		})).toThrow(/overview\.activeProducts/u);
	});
});
