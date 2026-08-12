import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	createApiPublicationConcern: vi.fn(),
	readApiPublicationReviewQueue: vi.fn(),
	requireModeratorApiAccess: vi.fn(),
	resolveApiPublicationConcern: vi.fn(),
}));

vi.mock("$lib/server/api/publicationConcerns.server", async () => {
	const actual = await vi.importActual<typeof import("$lib/server/api/publicationConcerns.server")>(
		"$lib/server/api/publicationConcerns.server",
	);
	return {
		...actual,
		createApiPublicationConcern: mocks.createApiPublicationConcern,
		readApiPublicationReviewQueue: mocks.readApiPublicationReviewQueue,
		resolveApiPublicationConcern: mocks.resolveApiPublicationConcern,
	};
});
vi.mock("$lib/server/moderation/moderationAccess.server", () => ({
	requireModeratorApiAccess: mocks.requireModeratorApiAccess,
}));

import { POST as submitConcern } from "../../src/routes/api/publication-concerns/+server";
import {
	GET as readReviewQueue,
	PATCH as resolveConcern,
} from "../../src/routes/api/moderation/publication-concerns/+server";

const createEvent = (body?: unknown, userId: string | null = null) => ({
	locals: {
		getVerifiedUser: vi.fn().mockResolvedValue(userId ? { id: userId } : null),
		supabase: {},
	},
	request: new Request("http://localhost/api/publication-concerns", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body ?? {}),
	}),
});

describe("API publication concern routes", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.requireModeratorApiAccess.mockResolvedValue({
			user: { id: "moderator-id" },
			role: "moderator",
		});
	});

	it("accepts a bounded signed-out rights report without exposing contact details", async () => {
		mocks.createApiPublicationConcern.mockResolvedValue({
			id: "concern-id",
			status: "open",
		});
		const response = await submitConcern(createEvent({
			reporterType: "rights-holder",
			contactName: "Rights Team",
			contactEmail: "rights@example.com",
			concernType: "rights-or-license",
			subjectType: "product",
			subjectReference: "00021130493609",
			details: "This image requires a rights review.",
			evidenceUrls: ["https://example.com/evidence"],
		}) as never);

		expect(response.status).toBe(202);
		expect(response.headers.get("cache-control")).toBe("private, no-store");
		expect(await response.json()).toEqual({
			data: { id: "concern-id", status: "open" },
		});
		expect(mocks.createApiPublicationConcern).toHaveBeenCalledWith(
			expect.objectContaining({ reporterUserId: undefined }),
		);
	});

	it("rejects invalid intake before storage", async () => {
		await expect(submitConcern(createEvent({
			reporterType: "brand",
			contactEmail: "brand@example.com",
			concernType: "rights-or-license",
			subjectType: "product",
			subjectReference: "bad",
			details: "Review this.",
			evidenceUrls: "not-an-array",
		}) as never)).rejects.toMatchObject({ status: 400 });
		expect(mocks.createApiPublicationConcern).not.toHaveBeenCalled();
	});

	it("lets elevated reviewers read and resolve the private queue", async () => {
		const queue = { concerns: [{ id: "concern-id" }], activeHolds: [] };
		mocks.readApiPublicationReviewQueue.mockResolvedValue(queue);
		const readResponse = await readReviewQueue(createEvent() as never);
		expect(await readResponse.json()).toEqual({ data: queue });
		expect(readResponse.headers.get("cache-control")).toBe("private, no-store");

		mocks.resolveApiPublicationConcern.mockResolvedValue(true);
		const event = createEvent();
		event.request = new Request("http://localhost/api/moderation/publication-concerns", {
			method: "PATCH",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				concernId: "11111111-1111-4111-8111-111111111111",
				status: "resolved",
				resolutionAction: "publication-hold",
				resolutionNote: "Held while rights are checked.",
			}),
		});
		const resolveResponse = await resolveConcern(event as never);
		expect(await resolveResponse.json()).toEqual({ data: { resolved: true } });
	});

	it("requires moderator access for queue reads", async () => {
		mocks.requireModeratorApiAccess.mockRejectedValue({ status: 403 });
		await expect(readReviewQueue(createEvent() as never)).rejects.toMatchObject({
			status: 403,
		});
		expect(mocks.readApiPublicationReviewQueue).not.toHaveBeenCalled();
	});

	it("requires dismissed concerns to record that no publication change occurred", async () => {
		const event = createEvent();
		event.request = new Request("http://localhost/api/moderation/publication-concerns", {
			method: "PATCH",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				concernId: "11111111-1111-4111-8111-111111111111",
				status: "dismissed",
				resolutionAction: "publication-hold",
				resolutionNote: "No action was needed.",
			}),
		});

		await expect(resolveConcern(event as never)).rejects.toMatchObject({
			status: 400,
		});
		expect(mocks.resolveApiPublicationConcern).not.toHaveBeenCalled();
	});
});
