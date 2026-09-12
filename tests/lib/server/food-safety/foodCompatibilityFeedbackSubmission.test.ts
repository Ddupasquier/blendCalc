import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getSupabaseAdminClient: vi.fn(),
}));

vi.mock("$lib/supabase/admin.server", () => ({
	getSupabaseAdminClient: mocks.getSupabaseAdminClient,
}));

import { submitFoodCompatibilityFeedback } from "$lib/server/food-safety/foodCompatibilityFeedback.server";

const createQuery = (result: Record<string, unknown> = {}) => {
	const query = {
		select: vi.fn(),
		eq: vi.fn(),
		order: vi.fn(),
		limit: vi.fn(),
		single: vi.fn(),
		maybeSingle: vi.fn(),
		insert: vi.fn(),
	};
	for (const method of ["select", "eq", "order", "limit"] as const) {
		query[method].mockReturnValue(query);
	}
	query.single.mockResolvedValue(result);
	query.maybeSingle.mockResolvedValue(result);
	query.insert.mockResolvedValue(result);
	return query;
};

describe("submitFoodCompatibilityFeedback", () => {
	beforeEach(() => vi.clearAllMocks());

	it("binds a warning dispute to the exact current catalog revision", async () => {
		const policyQuery = createQuery({
			data: { id: "policy-id", version_number: 4 },
			error: null,
		});
		const productQuery = createQuery({
			data: { id: "418a0615-a025-4b28-9fc9-f1ea62dddca4" },
			error: null,
		});
		const revisionQuery = createQuery({
			data: { id: "518a0615-a025-4b28-9fc9-f1ea62dddca4" },
			error: null,
		});
		const feedbackQuery = createQuery({ error: null });
		const admin = {
			from: vi.fn((table: string) => {
				switch (table) {
					case "food_compatibility_policy_versions":
						return policyQuery;
					case "shared_products":
						return productQuery;
					case "shared_product_revisions":
						return revisionQuery;
					case "food_compatibility_feedback":
						return feedbackQuery;
					default:
						throw new Error(`Unexpected table: ${table}`);
				}
			}),
		};
		mocks.getSupabaseAdminClient.mockReturnValue(admin);

		await expect(
			submitFoodCompatibilityFeedback("user-id", {
				sharedProductId: "418a0615-a025-4b28-9fc9-f1ea62dddca4",
				sourceKey: "open-food-facts",
				sourceId: "00011110129505",
				barcode: "00011110129505",
				foodDescription: "Example Product",
				warningId: "allergen-soy-soy-contains",
				issueCode: "FOOD_ALLERGEN_CONTAINS",
				issueParams: { factLabel: "Soy" },
				factSnapshot: [],
				reportReason: "incorrect_match",
				reportDetails: null,
			}),
		).resolves.toBe("submitted");

		expect(feedbackQuery.insert).toHaveBeenCalledWith(
			expect.objectContaining({
				shared_product_id: "418a0615-a025-4b28-9fc9-f1ea62dddca4",
				shared_product_revision_id: "518a0615-a025-4b28-9fc9-f1ea62dddca4",
				policy_version_id: "policy-id",
			}),
		);
	});
});
