import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	parseMissingFoodWarningFeedbackRequest: vi.fn(),
	submitMissingFoodWarningFeedback: vi.fn(),
}));

vi.mock(
	"$lib/server/food-safety/foodCompatibilityFeedback.server",
	() => ({
		parseMissingFoodWarningFeedbackRequest:
			mocks.parseMissingFoodWarningFeedbackRequest,
		submitMissingFoodWarningFeedback:
			mocks.submitMissingFoodWarningFeedback,
	}),
);

import { POST } from "../../src/routes/api/food-compatibility/missing-warning/+server";

const validInput = {
	sharedProductId: "418a0615-a025-4b28-9fc9-f1ea62dddca4",
	sourceKey: "open-food-facts",
	sourceId: "00011110129505",
	barcode: "00011110129505",
	foodDescription: "Example Product",
	preferenceTagId: "6cd4fcf5-9221-4b5b-ae90-b0d20f26af1b",
	preferenceType: "allergen",
	observedLabelDate: null,
	reportDetails: "The current ingredients list includes milk.",
	evidenceFile: null,
};

const createEvent = (userId: string | null) => ({
	locals: {
		getVerifiedUser: vi.fn().mockResolvedValue(userId ? { id: userId } : null),
	},
	request: new Request(
		"http://localhost:5173/api/food-compatibility/missing-warning",
		{
			method: "POST",
			body: new FormData(),
		},
	),
});

describe("missing food warning feedback route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.parseMissingFoodWarningFeedbackRequest.mockReturnValue(validInput);
		mocks.submitMissingFoodWarningFeedback.mockResolvedValue("submitted");
	});

	it("derives ownership from the verified user", async () => {
		const response = await POST(createEvent("user-1") as never);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ status: "submitted" });
		expect(mocks.submitMissingFoodWarningFeedback)
			.toHaveBeenCalledWith("user-1", validInput);
	});

	it("returns an idempotent pending-report result", async () => {
		mocks.submitMissingFoodWarningFeedback
			.mockResolvedValue("already_pending");

		const response = await POST(createEvent("user-1") as never);

		expect(await response.json()).toEqual({ status: "already_pending" });
	});

	it("rejects signed-out, malformed, and unresolvable reports", async () => {
		expect((await POST(createEvent(null) as never)).status).toBe(401);

		mocks.parseMissingFoodWarningFeedbackRequest.mockReturnValue(null);
		expect((await POST(createEvent("user-1") as never)).status).toBe(400);

		mocks.parseMissingFoodWarningFeedbackRequest.mockReturnValue(validInput);
		mocks.submitMissingFoodWarningFeedback.mockResolvedValue("invalid");
		expect((await POST(createEvent("user-1") as never)).status).toBe(400);
	});
});
