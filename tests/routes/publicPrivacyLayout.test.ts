import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("$lib/utils/profile/profile", () => ({
	getUserProfile: vi.fn(),
	getSignedAvatarUrl: vi.fn(),
}));
vi.mock("$lib/utils/auth/passwordUpgrade", () => ({
	getPasswordUpgradeNext: vi.fn(),
}));

import { load } from "../../src/routes/+layout.server";
import { getUserProfile } from "$lib/utils/profile/profile";
import { getPasswordUpgradeNext } from "$lib/utils/auth/passwordUpgrade";

const event = (pathname: string, user: unknown = null) => ({
	url: new URL(`http://localhost:5174${pathname}`),
	route: { id: pathname },
	locals: { getVerifiedUser: vi.fn().mockResolvedValue(user) },
	cookies: { get: vi.fn(), set: vi.fn() },
});

describe("public policy page admission", () => {
	beforeEach(() => vi.clearAllMocks());
	it.each(["/", "/auth", "/privacy", "/terms", "/demo"])(
		"admits signed-out readers at %s without account data",
		async (pathname) => {
			const result = await load(event(pathname) as never);
			expect(result).toMatchObject({ authUser: null });
			expect(getUserProfile).not.toHaveBeenCalled();
		},
	);
	it.each([
		"/ingredients/fridge",
		"/privacy/private",
		"/privacy-extra",
		"/terms/private",
		"/terms-extra",
		"/demo/private",
		"/demo-extra",
	])("keeps %s protected", async (pathname) => {
		await expect(load(event(pathname) as never)).rejects.toMatchObject({
			status: 303,
			location: `/?next=${encodeURIComponent(pathname)}`,
		});
	});
	it.each(["/privacy", "/terms", "/demo"])(
		"permits %s during a required password upgrade",
		async (pathname) => {
			vi.mocked(getPasswordUpgradeNext).mockReturnValue("/ingredients/fridge");
			const user = { id: "user-1" };
			expect(await load(event(pathname, user) as never)).toMatchObject({
				authUser: null,
				storageUserId: "user-1",
			});
			expect(getUserProfile).not.toHaveBeenCalled();
			await expect(load(event("/saved", user) as never)).rejects.toMatchObject({
				status: 303,
				location:
					"/auth/update-password?reason=policy&next=%2Fingredients%2Ffridge",
			});
		},
	);
});
