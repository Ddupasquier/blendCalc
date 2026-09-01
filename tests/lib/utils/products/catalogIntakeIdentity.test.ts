import { describe, expect, it } from "vitest";
import { validateCatalogIntakeIdentity } from "$lib/utils/products/catalogIntakeIdentity";
import type { FoodItem } from "$lib/utils/food/types";

const submittedFood = {
	fdcId: -1,
	description: "Roasted Onion & Garlic Pasta Sauce",
	brandOwner: "Signature Select",
	foodNutrients: [],
} satisfies FoodItem;

const canonicalRecord = {
	source: "canonical" as const,
	sourceReference: "product-1",
	productName: "Roasted Onion and Garlic Pasta Sauce",
	brandOwner: "Signature Select",
};

const sourceRecord = {
	source: "usda" as const,
	sourceReference: "2658692",
	productName: "Roasted Onion Garlic Pasta Sauce",
	brandOwner: "Signature Select",
};

const validate = (
	overrides: Partial<Parameters<typeof validateCatalogIntakeIdentity>[0]> = {},
) =>
	validateCatalogIntakeIdentity({
		submittedFood,
		canonicalRecord: null,
		exactSourceRecords: [sourceRecord],
		intent: "catalog_share",
		minimumRelatedNameTokenOverlap: 0.2,
		...overrides,
	});

describe("catalog intake identity validation", () => {
	it("accepts normalized identity supported by exact source records", () => {
		expect(validate()).toMatchObject({
			disposition: "accept",
			blockingRecord: null,
			checks: [
				{
					source: "usda",
					nameRelationship: "related",
					brandRelationship: "related",
					outcome: "match",
				},
			],
		});
	});

	it("rejects an unrelated ordinary submission against the canonical record", () => {
		const result = validate({
			submittedFood: {
				...submittedFood,
				description: "Synthetic Motor Oil",
			},
			canonicalRecord,
		});

		expect(result.disposition).toBe("reject");
		expect(result.blockingRecord).toMatchObject({
			source: "canonical",
			productName: canonicalRecord.productName,
			outcome: "mismatch",
		});
	});

	it("requires evidence review for an explicit canonical correction", () => {
		const result = validate({
			submittedFood: {
				...submittedFood,
				description: "New Manufacturer Product",
			},
			canonicalRecord,
			intent: "catalog_correction",
		});

		expect(result.disposition).toBe("review");
		expect(result.blockingRecord).toBeNull();
		expect(result.reviewFlags[0]).toContain("canonical");
	});

	it("rejects when every exact source record has an unrelated identity", () => {
		const result = validate({
			exactSourceRecords: [
				{
					...sourceRecord,
					productName: "Sparkling Drinking Water",
				},
				{
					...sourceRecord,
					source: "open-food-facts",
					sourceReference: "00021130493609",
					productName: "Purified Drinking Water",
				},
			],
		});

		expect(result.disposition).toBe("reject");
		expect(result.checks).toHaveLength(2);
		expect(result.checks.every((check) => check.outcome === "mismatch")).toBe(
			true,
		);
	});

	it("keeps conflicting exact sources in evidence review when one supports identity", () => {
		const result = validate({
			exactSourceRecords: [
				sourceRecord,
				{
					...sourceRecord,
					source: "open-food-facts",
					sourceReference: "00021130493609",
					productName: "Purified Drinking Water",
				},
			],
		});

		expect(result.disposition).toBe("review");
		expect(result.blockingRecord).toBeNull();
		expect(result.reviewFlags[0]).toContain("open-food-facts");
	});

	it("reviews a material brand mismatch without rejecting a related product", () => {
		const result = validate({
			exactSourceRecords: [
				{
					...sourceRecord,
					brandOwner: "Unrelated Company",
				},
			],
		});

		expect(result).toMatchObject({
			disposition: "review",
			checks: [{ outcome: "review", brandRelationship: "unrelated" }],
		});
	});

	it("requires package evidence when no canonical or exact-source identity exists", () => {
		expect(
			validate({
				canonicalRecord: null,
				exactSourceRecords: [],
			}),
		).toMatchObject({
			disposition: "review",
			checks: [],
			blockingRecord: null,
		});
	});
});
