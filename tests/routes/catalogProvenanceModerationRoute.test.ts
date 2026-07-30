import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getUserAppRole: vi.fn(),
	readCatalogProvenanceReviewRecord: vi.fn(),
}));

vi.mock("$lib/utils/moderation/moderation", () => ({
	getUserAppRole: mocks.getUserAppRole,
}));

vi.mock("$lib/server/products/catalogProvenanceReview.server", () => ({
	readCatalogProvenanceReviewRecord:
		mocks.readCatalogProvenanceReviewRecord,
}));

import { GET } from "../../src/routes/api/moderation/catalog/products/[productId]/provenance/+server";

const createEvent = (userId: string | null) => ({
	locals: {
		getVerifiedUser: vi.fn().mockResolvedValue(
			userId ? { id: userId } : null,
		),
		supabase: {},
	},
	params: { productId: "product-id" },
});

describe("catalog provenance moderation route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns field-level observations to moderators without public caching", async () => {
		const record = {
			product: {
				id: "product-id",
				barcode: "00021130493609",
				name: "Roasted Onion & Garlic Pasta Sauce",
			},
			fields: [{
				id: "field-id",
				fieldPath: "ingredients",
				sourceValue: "Tomatoes, garlic",
				normalizedValue: "Tomatoes, garlic",
				confidence: "imported",
				verificationMethod: "exact-barcode",
				selected: true,
				createdAt: "2026-07-29T12:00:00.000Z",
				observation: {
					id: "observation-id",
					source: "open-food-facts",
					sourceReference: "00021130493609",
					sourceLicense: "ODbL-1.0",
					observedAt: "2026-07-29T12:00:00.000Z",
					createdAt: "2026-07-29T12:00:00.000Z",
					expiresAt: null,
				},
			}],
		};
		mocks.getUserAppRole.mockResolvedValue("moderator");
		mocks.readCatalogProvenanceReviewRecord.mockResolvedValue(record);

		const response = await GET(createEvent("moderator-id") as never);

		expect(response.status).toBe(200);
		expect(response.headers.get("cache-control")).toBe("private, no-store");
		expect(await response.json()).toEqual({ data: record });
	});

	it("blocks signed-out and ordinary users", async () => {
		await expect(GET(createEvent(null) as never)).rejects.toMatchObject({
			status: 401,
		});

		mocks.getUserAppRole.mockResolvedValue(null);
		await expect(GET(createEvent("user-id") as never)).rejects.toMatchObject({
			status: 403,
		});
		expect(mocks.readCatalogProvenanceReviewRecord).not.toHaveBeenCalled();
	});

	it("returns not found for an unknown catalog product", async () => {
		mocks.getUserAppRole.mockResolvedValue("admin");
		mocks.readCatalogProvenanceReviewRecord.mockResolvedValue(null);

		await expect(
			GET(createEvent("admin-id") as never),
		).rejects.toMatchObject({ status: 404 });
	});
});
