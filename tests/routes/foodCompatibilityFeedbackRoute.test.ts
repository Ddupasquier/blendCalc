import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	parseFoodCompatibilityFeedbackRequest: vi.fn(),
	submitFoodCompatibilityFeedback: vi.fn(),
}));

vi.mock(
	"$lib/server/food-safety/foodCompatibilityFeedback.server",
	() => ({
		parseFoodCompatibilityFeedbackRequest:
			mocks.parseFoodCompatibilityFeedbackRequest,
		submitFoodCompatibilityFeedback:
			mocks.submitFoodCompatibilityFeedback,
	}),
);

import { POST } from "../../src/routes/api/food-compatibility/feedback/+server";

const validInput = {
	sharedProductId: null,
	sourceKey: "usda",
	sourceId: "123",
	barcode: null,
	foodDescription: "Peanut butter",
	warningId: "allergen-peanut",
	issueCode: "FOOD_ALLERGEN_CONTAINS",
	issueParams: { factLabel: "Peanut" },
	factSnapshot: [],
	reportReason: "incorrect_match",
	reportDetails: null,
};

const createEvent = (userId: string | null, body: unknown) => ({
	locals: {
		getVerifiedUser: vi.fn().mockResolvedValue(userId ? { id: userId } : null),
	},
	request: new Request(
		"http://localhost:5173/api/food-compatibility/feedback",
		{
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body),
		},
	),
});

describe("food compatibility feedback route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.parseFoodCompatibilityFeedbackRequest.mockReturnValue(validInput);
		mocks.submitFoodCompatibilityFeedback.mockResolvedValue("submitted");
	});

	it("derives report ownership from the signed-in user", async () => {
		const response = await POST(
			createEvent("user-1", validInput) as never,
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ status: "submitted" });
		expect(mocks.submitFoodCompatibilityFeedback)
			.toHaveBeenCalledWith("user-1", validInput);
	});

	it("returns an idempotent pending-report result", async () => {
		mocks.submitFoodCompatibilityFeedback
			.mockResolvedValue("already_pending");

		const response = await POST(
			createEvent("user-1", validInput) as never,
		);

		expect(await response.json())
			.toEqual({ status: "already_pending" });
	});

	it("rejects signed-out reports", async () => {
		const response = await POST(createEvent(null, validInput) as never);

		expect(response.status).toBe(401);
		expect(mocks.submitFoodCompatibilityFeedback).not.toHaveBeenCalled();
	});

	it("rejects malformed reports", async () => {
		mocks.parseFoodCompatibilityFeedbackRequest.mockReturnValue(null);

		const response = await POST(
			createEvent("user-1", { warningId: "" }) as never,
		);

		expect(response.status).toBe(400);
		expect(mocks.submitFoodCompatibilityFeedback).not.toHaveBeenCalled();
	});
});
