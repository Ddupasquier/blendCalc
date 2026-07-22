import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	writeTutorialChoice: vi.fn(),
}));

vi.mock("$lib/utils/tutorial/tutorial", () => ({
	writeTutorialChoice: mocks.writeTutorialChoice,
}));

import { POST } from "../../src/routes/api/tutorial-preference/+server";

const createEvent = (userId: string | null, body: unknown) => ({
	locals: {
		getVerifiedUser: vi.fn().mockResolvedValue(userId ? { id: userId } : null),
		supabase: { source: "test" },
	},
	request: new Request("http://localhost:5173/api/tutorial-preference", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	}),
});

describe("tutorial preference route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.writeTutorialChoice.mockResolvedValue(true);
	});

	it("derives tutorial ownership from the signed-in user", async () => {
		const event = createEvent("user-1", { choice: "complete" });
		const response = await POST(event as never);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ saved: true });
		expect(mocks.writeTutorialChoice).toHaveBeenCalledWith(
			event.locals.supabase,
			"user-1",
			"complete",
		);
	});

	it("rejects unsupported choices", async () => {
		const response = await POST(
			createEvent("user-1", { choice: "someone-elses-user" }) as never,
		);

		expect(response.status).toBe(400);
		expect(mocks.writeTutorialChoice).not.toHaveBeenCalled();
	});

	it("rejects signed-out writes", async () => {
		const response = await POST(createEvent(null, { choice: "complete" }) as never);

		expect(response.status).toBe(401);
		expect(mocks.writeTutorialChoice).not.toHaveBeenCalled();
	});
});
