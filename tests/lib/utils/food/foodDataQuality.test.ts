import { describe, expect, it } from "vitest";
import {
	getFoodDataQualityDisclosure,
	type FoodDataQualityCode,
} from "$lib/utils/food/quality/foodDataQuality";
import type { FdcFood } from "$lib/utils/food/types";

const makeFood = (overrides: Partial<FdcFood> = {}): FdcFood => ({
	fdcId: 1,
	description: "Example food",
	foodNutrients: [],
	...overrides,
});

const getCodes = (food: FdcFood) =>
	(getFoodDataQualityDisclosure(food)?.notices ?? [])
		.map((notice) => notice.code);

const expectCode = (food: FdcFood, code: FoodDataQualityCode) => {
	expect(getCodes(food)).toContain(code);
};

describe("food data quality disclosure", () => {
	it("stays hidden when no useful quality note exists", () => {
		expect(getFoodDataQualityDisclosure(makeFood())).toBeNull();
		expect(
			getFoodDataQualityDisclosure(makeFood({
				sourceMetadata: {
					schemaVersion: 4,
					completeness: 1,
				},
			})),
		).toBeNull();
	});

	it("keeps source-reported completeness and format context distinct", () => {
		const disclosure = getFoodDataQualityDisclosure(makeFood({
			sourceMetadata: {
				completeness: 0.734,
				schemaVersion: 4,
			},
		}));

		expect(disclosure).toMatchObject({
			schemaVersion: 4,
			notices: [{
				code: "SOURCE_RECORD_PARTIAL",
				percentage: 73,
			}],
		});
	});

	it("reduces raw source warning, error, and quality tags to bounded codes", () => {
		expectCode(
			makeFood({
				sourceMetadata: {
					qualityWarningTags: ["provider-warning-that-must-not-render"],
				},
			}),
			"SOURCE_RECORD_WARNING",
		);
		expectCode(
			makeFood({
				sourceMetadata: {
					qualityErrorTags: ["provider-error-that-must-not-render"],
				},
			}),
			"SOURCE_RECORD_ERROR",
		);
		expectCode(
			makeFood({
				sourceMetadata: {
					qualityTags: ["provider-quality-note-that-must-not-render"],
				},
			}),
			"SOURCE_RECORD_QUALITY_NOTES",
		);
	});

	it("identifies source records explicitly marked obsolete", () => {
		expectCode(
			makeFood({
				sourceMetadata: {
					obsolete: true,
					obsoleteSince: "2025-01-01",
				},
			}),
			"SOURCE_RECORD_OBSOLETE",
		);
	});

	it("explains when accepted product fields use multiple sources", () => {
		const disclosure = getFoodDataQualityDisclosure(makeFood({
			fieldProvenance: {
				nutrition: { source: "usda", sourceReference: "123" },
				image: {
					source: "open-food-facts",
					sourceReference: "00012345678905",
				},
			},
		}));

		expect(disclosure?.notices).toContainEqual({
			code: "ACCEPTED_FIELDS_COMBINE_SOURCES",
			count: 2,
		});
	});

	it("keeps source tag aggregation separate from field-level sources", () => {
		const disclosure = getFoodDataQualityDisclosure(makeFood({
			sourceMetadata: {
				tagSources: {
					labels: ["source-a", "source-b"],
				},
			},
		}));

		expect(disclosure?.notices).toContainEqual({
			code: "SOURCE_METADATA_COMBINES_RECORDS",
			count: 2,
		});
	});
});
