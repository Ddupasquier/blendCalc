import { describe, expect, it } from "vitest";
import { isProductResolutionPolicySchemaUnavailable } from "$lib/server/products/productResolutionPolicy.server";

describe("product resolution policy rollout detection", () => {
	it.each([
		{
			code: "42P01",
			message: 'relation "product_resolution_policy_versions" does not exist',
		},
		{
			code: "PGRST204",
			message:
				"Could not find the 'assessment_policy_key' column of 'nutrition_completeness_profiles' in the schema cache",
		},
	])("recognizes an exact missing policy schema object", (error) => {
		expect(isProductResolutionPolicySchemaUnavailable(error)).toBe(true);
	});

	it("does not hide permission or unrelated database failures", () => {
		expect(
			isProductResolutionPolicySchemaUnavailable({
				code: "42501",
				message: "permission denied for product_resolution_policy_versions",
			}),
		).toBe(false);
		expect(
			isProductResolutionPolicySchemaUnavailable({
				code: "42P01",
				message: 'relation "shared_products" does not exist',
			}),
		).toBe(false);
	});
});
