import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	assertCanSubmitSharedProduct: vi.fn(),
	submitCatalogIntake: vi.fn(),
	uploadProductEvidence: vi.fn(),
}));

vi.mock("$lib/server/products/catalog.server", () => ({
	assertCanSubmitSharedProduct: mocks.assertCanSubmitSharedProduct,
	ProductSubmissionBlockedError: class ProductSubmissionBlockedError extends Error {},
}));

vi.mock("$lib/server/products/catalogIntake.server", () => ({
	submitCatalogIntake: mocks.submitCatalogIntake,
}));

vi.mock("$lib/server/products/productEvidence.server", () => ({
	uploadProductEvidence: mocks.uploadProductEvidence,
}));

import { POST } from "../../src/routes/api/intake/v1/product-observations/+server";
import { POST as legacySubmissionPOST } from "../../src/routes/api/products/submissions/+server";

const food = {
	fdcId: -1,
	description: "Trader Joe's Peanut Butter",
	barcode: "00000000119993",
	barcodeSource: "open-food-facts",
	foodNutrients: [],
};

const createEvent = ({
	consentToShare,
	apiKey,
	userId = "qa-user-id",
}: {
	consentToShare: boolean;
	apiKey?: string;
	userId?: string | null;
}) => {
	const formData = new FormData();
	formData.set("food", JSON.stringify(food));
	if (consentToShare) formData.set("consentToShare", "true");
	formData.set("submissionIntent", "catalog_share");

	return {
		locals: {
			getVerifiedUser: vi
				.fn()
				.mockResolvedValue(userId ? { id: userId } : null),
		},
		request: new Request(
			"http://localhost:5173/api/intake/v1/product-observations",
			{
				method: "POST",
				headers: apiKey ? { "x-blendcalc-api-key": apiKey } : undefined,
				body: formData,
			},
		),
	};
};

describe("catalog submission route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.assertCanSubmitSharedProduct.mockResolvedValue(undefined);
		mocks.uploadProductEvidence.mockResolvedValue({});
		mocks.submitCatalogIntake.mockResolvedValue({
			status: "pending",
			message: "The product is waiting for review.",
			evidenceAccepted: true,
		});
	});

	it("keeps the legacy app endpoint as a compatibility alias", () => {
		expect(legacySubmissionPOST).toBe(POST);
	});

	it("creates exactly one submission after explicit sharing consent", async () => {
		const response = await POST(createEvent({ consentToShare: true }) as never);

		expect(response.status).toBe(201);
		expect(await response.json()).toEqual({
			status: "pending",
			message: "The product is waiting for review.",
			evidenceAccepted: true,
		});
		expect(mocks.submitCatalogIntake).toHaveBeenCalledOnce();
		expect(mocks.submitCatalogIntake).toHaveBeenCalledWith({
			actorUserId: "qa-user-id",
			food,
			evidencePaths: {},
			reviewFlags: [],
			frontImageCrop: null,
			intent: "catalog_share",
		});
	});

	it("rejects a request without explicit sharing consent", async () => {
		await expect(
			POST(createEvent({ consentToShare: false }) as never),
		).rejects.toMatchObject({ status: 400 });

		expect(mocks.uploadProductEvidence).not.toHaveBeenCalled();
		expect(mocks.assertCanSubmitSharedProduct).not.toHaveBeenCalled();
		expect(mocks.submitCatalogIntake).not.toHaveBeenCalled();
	});

	it("rejects a signed-out submission", async () => {
		await expect(
			POST(createEvent({ consentToShare: true, userId: null }) as never),
		).rejects.toMatchObject({ status: 401 });

		expect(mocks.submitCatalogIntake).not.toHaveBeenCalled();
	});

	it("does not accept an API key without an authenticated app session", async () => {
		await expect(
			POST(
				createEvent({
					consentToShare: true,
					apiKey: `bc_test_${"A".repeat(43)}`,
					userId: null,
				}) as never,
			),
		).rejects.toMatchObject({ status: 401 });

		expect(mocks.submitCatalogIntake).not.toHaveBeenCalled();
	});
});
