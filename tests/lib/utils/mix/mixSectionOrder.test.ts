import { describe, expect, it } from "vitest";
import {
	DEFAULT_MIX_SECTION_DISCLOSURE_STATE,
	DEFAULT_MIX_SECTION_ORDER,
	moveMixSection,
	moveMixSectionRelative,
	normalizeMixSectionDisclosureState,
	normalizeMixSectionOrder,
} from "$lib/utils/mix/ui/mixSectionOrder";

describe("Mix section order", () => {
	it("starts supporting insight sections closed", () => {
		expect(DEFAULT_MIX_SECTION_DISCLOSURE_STATE).toMatchObject({
			warnings: false,
			"suggested-adjustments": false,
			"nutrient-contributions": false,
		});
	});

	it("keeps valid saved order while appending new sections safely", () => {
		expect(normalizeMixSectionOrder(["goals", "nutrient-shape"])).toEqual([
			"goals",
			"nutrient-shape",
			"selected-ingredients",
			"add-ingredients",
			"warnings",
			"suggested-adjustments",
			"nutrient-contributions",
		]);
	});

	it("drops unknown and duplicate values without losing supported sections", () => {
		const normalized = normalizeMixSectionOrder([
			"warnings",
			"unknown",
			"warnings",
			null,
		]);

		expect(normalized[0]).toBe("warnings");
		expect(normalized).toHaveLength(DEFAULT_MIX_SECTION_ORDER.length);
		expect(new Set(normalized)).toEqual(new Set(DEFAULT_MIX_SECTION_ORDER));
	});

	it("moves sections by absolute and relative positions", () => {
		expect(
			moveMixSection(DEFAULT_MIX_SECTION_ORDER, "warnings", 0)[0],
		).toBe("warnings");
		expect(
			moveMixSectionRelative(
				DEFAULT_MIX_SECTION_ORDER,
				"nutrient-shape",
				"goals",
				true,
			).slice(0, 2),
		).toEqual(["goals", "nutrient-shape"]);
	});

	it("restores every disclosure while preserving valid saved booleans", () => {
		expect(
			normalizeMixSectionDisclosureState({
				goals: false,
				warnings: false,
				unknown: true,
				"add-ingredients": "closed",
			}),
		).toEqual({
			...DEFAULT_MIX_SECTION_DISCLOSURE_STATE,
			goals: false,
			warnings: false,
		});
	});
});
