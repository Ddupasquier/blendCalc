import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	assertCanSubmitSharedProduct: vi.fn(),
	deleteProductEvidence: vi.fn(),
	submitProductForCatalog: vi.fn(),
	uploadProductEvidence: vi.fn(),
}));

vi.mock("$lib/server/products/catalog.server", () => ({
	assertCanSubmitSharedProduct: mocks.assertCanSubmitSharedProduct,
	ProductSubmissionBlockedError: class ProductSubmissionBlockedError extends Error {},
	submitProductForCatalog: mocks.submitProductForCatalog,
}));

vi.mock("$lib/server/products/productEvidence.server", () => ({
	deleteProductEvidence: mocks.deleteProductEvidence,
	uploadProductEvidence: mocks.uploadProductEvidence,
}));

import { POST } from "../../src/routes/api/products/submissions/+server";

const food = {
	fdcId: -1,
	description: "Trader Joe's Peanut Butter",
	barcode: "00000000119993",
	barcodeSource: "open-food-facts",
	foodNutrients: [],
};

const createEvent = ({
	consentToShare,
	userId = "qa-user-id",
}: {
	consentToShare: boolean;
	userId?: string | null;
}) => {
	const formData = new FormData();
	formData.set("food", JSON.stringify(food));
	if (consentToShare) formData.set("consentToShare", "true");
	formData.set("submissionIntent", "catalog_share");

	return {
		locals: {
			getVerifiedUser: vi.fn().mockResolvedValue(
				userId ? { id: userId } : null,
			),
		},
		request: new Request("http://localhost:5173/api/products/submissions", {
			method: "POST",
			body: formData,
		}),
	};
};

describe("catalog submission route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.assertCanSubmitSharedProduct.mockResolvedValue(undefined);
		mocks.uploadProductEvidence.mockResolvedValue({});
		mocks.deleteProductEvidence.mockResolvedValue(undefined);
		mocks.submitProductForCatalog.mockResolvedValue({
			status: "pending",
			message: "The product is waiting for review.",
			evidenceAccepted: true,
		});
	});

	it("creates exactly one submission after explicit sharing consent", async () => {
		const response = await POST(createEvent({ consentToShare: true }) as never);

		expect(response.status).toBe(201);
		expect(await response.json()).toEqual({
			status: "pending",
			message: "The product is waiting for review.",
			evidenceAccepted: true,
		});
		expect(mocks.submitProductForCatalog).toHaveBeenCalledOnce();
		expect(mocks.submitProductForCatalog).toHaveBeenCalledWith(
			"qa-user-id",
			food,
			{},
			{
				reviewFlags: [],
				frontImageCrop: null,
				intent: "catalog_share",
			},
		);
	});

	it("rejects a request without explicit sharing consent", async () => {
		await expect(
			POST(createEvent({ consentToShare: false }) as never),
		).rejects.toMatchObject({ status: 400 });

		expect(mocks.uploadProductEvidence).not.toHaveBeenCalled();
		expect(mocks.submitProductForCatalog).not.toHaveBeenCalled();
	});

	it("rejects a signed-out submission", async () => {
		await expect(
			POST(createEvent({ consentToShare: true, userId: null }) as never),
		).rejects.toMatchObject({ status: 401 });

		expect(mocks.submitProductForCatalog).not.toHaveBeenCalled();
	});
});
