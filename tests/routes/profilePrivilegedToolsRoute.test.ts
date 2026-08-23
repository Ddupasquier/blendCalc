import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	requireModeratorPermission: vi.fn(),
}));

vi.mock("$lib/server/moderation/moderationAccess.server", () => ({
	requireModeratorPermission: mocks.requireModeratorPermission,
}));

import { load } from "../../src/routes/profile/privileged-tools/+page.server";

describe("Profile privileged tools route", () => {
	beforeEach(() => vi.clearAllMocks());

	it("requires a current elevated role for direct sheet access", async () => {
		mocks.requireModeratorPermission.mockResolvedValue({
			user: { id: "moderator-id" },
			role: "moderator",
			permissions: ["moderation.access"],
		});
		const locals = {};

		await expect(load({ locals } as never)).resolves.toEqual({});
		expect(mocks.requireModeratorPermission).toHaveBeenCalledWith(
			locals,
			"moderation.access",
			"/profile/privileged-tools",
		);
	});

	it("keeps ordinary accounts out of the privileged sheet route", async () => {
		mocks.requireModeratorPermission.mockRejectedValue({ status: 403 });

		await expect(load({ locals: {} } as never)).rejects.toMatchObject({
			status: 403,
		});
	});
});
