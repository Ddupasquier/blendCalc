import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	requireModeratorAccess: vi.fn(),
}));

vi.mock("$lib/server/moderation/moderationAccess.server", () => ({
	requireModeratorAccess: mocks.requireModeratorAccess,
}));

import { load } from "../../src/routes/profile/moderator-actions/+page.server";

describe("Profile moderator actions route", () => {
	beforeEach(() => vi.clearAllMocks());

	it("requires a current elevated role for direct sheet access", async () => {
		mocks.requireModeratorAccess.mockResolvedValue({
			user: { id: "moderator-id" },
			role: "moderator",
		});
		const locals = {};

		await expect(load({ locals } as never)).resolves.toEqual({});
		expect(mocks.requireModeratorAccess).toHaveBeenCalledWith(
			locals,
			"/profile/moderator-actions",
		);
	});

	it("keeps ordinary accounts out of the privileged sheet route", async () => {
		mocks.requireModeratorAccess.mockRejectedValue({ status: 403 });

		await expect(load({ locals: {} } as never)).rejects.toMatchObject({
			status: 403,
		});
	});
});
