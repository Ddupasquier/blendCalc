import { describe, expect, it, vi } from "vitest";
import {
	getManualEntryReferenceDataAvailabilityMessages,
	loadManualEntryReferenceData,
	MANUAL_ENTRY_REFERENCE_DATA_UNAVAILABLE_MESSAGE,
	type ManualEntryReferenceData,
} from "$lib/utils/food/nutrients/manualEntryReferenceData";

const referenceData: ManualEntryReferenceData = {
	nutrientGroups: {
		macros: [],
		extended: [],
	},
	nutrientRelationshipRules: [],
	nutritionLabelOcrMappings: [],
	regulatoryDisclosureProfiles: [],
};

describe("manual entry reference data", () => {
	it("loads every manual entry catalog through one authenticated app request", async () => {
		const fetchRequest = vi.fn().mockResolvedValue(
			new Response(JSON.stringify(referenceData), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		);

		await expect(loadManualEntryReferenceData(fetchRequest)).resolves.toEqual(
			referenceData,
		);
		expect(fetchRequest).toHaveBeenCalledOnce();
		expect(fetchRequest).toHaveBeenCalledWith(
			"/api/manual-entry/reference-data",
			{ headers: { accept: "application/json" } },
		);
	});

	it("rejects malformed reference data rather than treating it as an empty catalog", async () => {
		const fetchRequest = vi
			.fn()
			.mockResolvedValue(new Response(JSON.stringify({ nutrientGroups: {} })));

		await expect(loadManualEntryReferenceData(fetchRequest)).rejects.toThrow(
			"Manual entry reference data response was invalid.",
		);
	});

	it("represents a whole-request failure with one visible availability message", () => {
		const messages = getManualEntryReferenceDataAvailabilityMessages(null);

		expect(Object.values(messages).filter(Boolean)).toEqual([
			MANUAL_ENTRY_REFERENCE_DATA_UNAVAILABLE_MESSAGE,
		]);
		expect(messages.nutrientRelationshipRuleError).toBe("");
		expect(messages.nutritionLabelOcrMappingError).toBe("");
	});
});
