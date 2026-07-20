import { describe, expect, it } from "vitest";
import { NUTRIENT_IDS } from "$lib/utils/food/types";
import {
	LEGACY_SODIUM_NUTRIENT_ID,
	migrateLegacyNutrientGoals,
	migrateLegacyNutrientIds,
	migrateLegacyNutrientOptions,
} from "$lib/utils/mix/nutrients/nutrientMappings";
import {
	getDefaultMixGoals,
	getNutrientCatalog,
} from "$lib/utils/food/reference/appReferenceCatalog";

describe("nutrient mappings", () => {
	it("uses the FDC sodium ID rather than saturated fat", () => {
		const nutrientCatalog = getNutrientCatalog();
		expect(nutrientCatalog).toContainEqual({
			id: NUTRIENT_IDS.SODIUM,
			label: "Sodium",
			unit: "mg",
			nutrientNumber: "307",
		});
		expect(
			nutrientCatalog.find(
				(nutrient) => Number(nutrient.id) === LEGACY_SODIUM_NUTRIENT_ID,
			),
		).toMatchObject({ label: "Saturated Fat", unit: "g" });
		expect(getDefaultMixGoals()[NUTRIENT_IDS.SODIUM]).toBe(500);
	});

	it("migrates legacy sodium selections, options, and goals", () => {
		expect(
			migrateLegacyNutrientIds(
				[1008, LEGACY_SODIUM_NUTRIENT_ID],
				true,
			),
		).toEqual([1008, NUTRIENT_IDS.SODIUM]);
		expect(
			migrateLegacyNutrientOptions([
				{ id: LEGACY_SODIUM_NUTRIENT_ID, label: "Sodium" },
			]),
		).toEqual([{ id: NUTRIENT_IDS.SODIUM, label: "Sodium" }]);
		expect(
			migrateLegacyNutrientGoals({
				[LEGACY_SODIUM_NUTRIENT_ID]: 700,
			}, true),
		).toEqual({ [NUTRIENT_IDS.SODIUM]: 700 });
	});

	it("keeps newly selected saturated fat data on nutrient ID 1258", () => {
		expect(
			migrateLegacyNutrientIds([LEGACY_SODIUM_NUTRIENT_ID]),
		).toEqual([LEGACY_SODIUM_NUTRIENT_ID]);
		expect(
			migrateLegacyNutrientOptions([
				{ id: LEGACY_SODIUM_NUTRIENT_ID, label: "Saturated Fat" },
			]),
		).toEqual([
			{ id: LEGACY_SODIUM_NUTRIENT_ID, label: "Saturated Fat" },
		]);
	});
});
