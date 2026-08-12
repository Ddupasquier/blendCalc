import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	placeApiPublicationHold: vi.fn(),
	releaseApiPublicationHold: vi.fn(),
	requireModeratorApiAccess: vi.fn(),
}));

vi.mock("$lib/server/api/publicationConcerns.server", () => ({
	placeApiPublicationHold: mocks.placeApiPublicationHold,
	releaseApiPublicationHold: mocks.releaseApiPublicationHold,
}));
vi.mock("$lib/server/moderation/moderationAccess.server", () => ({
	requireModeratorApiAccess: mocks.requireModeratorApiAccess,
}));

import {
	DELETE,
	POST,
} from "../../src/routes/api/moderation/publication-holds/+server";

const createEvent = (method: "POST" | "DELETE", body: unknown) => ({
	locals: { getVerifiedUser: vi.fn(), supabase: {} },
	request: new Request("http://localhost/api/moderation/publication-holds", {
		method,
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	}),
});

describe("API publication hold route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.requireModeratorApiAccess.mockResolvedValue({
			user: { id: "moderator-id" },
			role: "moderator",
		});
	});

	it("places an exact product hold through elevated access", async () => {
		mocks.placeApiPublicationHold.mockResolvedValue({ id: "hold-id" });
		const response = await POST(createEvent("POST", {
			subjectType: "product",
			subjectReference: "00021130493609",
			reasonCode: "accuracy-review",
			publicMessage: "Temporarily unavailable while details are reviewed.",
			internalNote: "Conflicting package evidence.",
		}) as never);
		expect(response.status).toBe(201);
		expect(response.headers.get("cache-control")).toBe("private, no-store");
		expect(mocks.placeApiPublicationHold).toHaveBeenCalledWith(
			expect.objectContaining({ actorUserId: "moderator-id" }),
		);
	});

	it("releases a hold without deleting it", async () => {
		mocks.releaseApiPublicationHold.mockResolvedValue(true);
		const response = await DELETE(createEvent("DELETE", {
			holdId: "11111111-1111-4111-8111-111111111111",
			releaseNote: "Evidence was corrected and reviewed.",
		}) as never);
		expect(await response.json()).toEqual({ data: { released: true } });
	});

	it("rejects invalid targets and ordinary users", async () => {
		await expect(POST(createEvent("POST", {
			subjectType: "everything",
			subjectReference: "unknown",
			reasonCode: "accuracy-review",
			publicMessage: "Unavailable.",
			internalNote: "Invalid target.",
		}) as never)).rejects.toMatchObject({ status: 400 });

		mocks.requireModeratorApiAccess.mockRejectedValueOnce({ status: 403 });
		await expect(DELETE(createEvent("DELETE", {
			holdId: "11111111-1111-4111-8111-111111111111",
			releaseNote: "No access.",
		}) as never)).rejects.toMatchObject({ status: 403 });
	});
});
