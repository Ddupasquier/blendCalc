import { describe, expect, it } from "vitest";
import { hydrateFoodWithCatalogState } from "$lib/utils/ingredients/ingredientCatalogState";
import type { FdcFood } from "$lib/utils/food/types";

const food: FdcFood = {
	fdcId: 1,
	description: "Private draft",
	foodNutrients: [],
	customFood: true,
	sourceKey: "custom",
	sharedProductId: "stale-product-id",
};

describe("ingredient catalog state hydration", () => {
	it("uses canonical saved-row catalog state instead of stale food JSON", () => {
		const hydrated = hydrateFoodWithCatalogState(food, {
			shared_product_id: "verified-product-id",
			shared_product_submission_id: null,
			source_key: "usda",
			trust_status: "source-verified",
		});

		expect(hydrated.sharedProductId).toBe("verified-product-id");
		expect(hydrated.sharedProductSubmissionId).toBeUndefined();
		expect(hydrated.sourceKey).toBe("usda");
		expect(hydrated.trustStatus).toBe("source-verified");
	});

	it("clears stale catalog ids and exposes pending review", () => {
		const hydrated = hydrateFoodWithCatalogState(food, {
			shared_product_id: null,
			shared_product_submission_id: "pending-submission-id",
			source_key: "custom",
			trust_status: "pending-review",
		});

		expect(hydrated.sharedProductId).toBeUndefined();
		expect(hydrated.sharedProductSubmissionId).toBe("pending-submission-id");
		expect(hydrated.trustStatus).toBe("pending-review");
	});
});
