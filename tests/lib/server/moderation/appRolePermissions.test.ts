import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getSupabaseAdminClient: vi.fn(),
}));

vi.mock("$lib/supabase/admin.server", () => ({
	getSupabaseAdminClient: mocks.getSupabaseAdminClient,
}));

import { readAppRolePermissions } from "$lib/server/moderation/appRolePermissions.server";

describe("application role permission reader", () => {
	beforeEach(() => vi.clearAllMocks());

	it("reads the current database-owned permissions for the verified role", async () => {
		const query = {
			select: vi.fn(),
			eq: vi.fn(),
			order: vi.fn(),
		};
		query.select.mockReturnValue(query);
		query.eq.mockReturnValue(query);
		query.order.mockResolvedValue({
			data: [
				{ permission: "moderation.access" },
				{ permission: "moderation.roles.manage" },
			],
			error: null,
		});
		mocks.getSupabaseAdminClient.mockReturnValue({
			from: vi.fn().mockReturnValue(query),
		});

		await expect(readAppRolePermissions("admin")).resolves.toEqual([
			"moderation.access",
			"moderation.roles.manage",
		]);
		expect(query.eq).toHaveBeenCalledWith("role", "admin");
	});

	it("fails closed when permission rows cannot be read", async () => {
		const query = {
			select: vi.fn(),
			eq: vi.fn(),
			order: vi.fn(),
		};
		query.select.mockReturnValue(query);
		query.eq.mockReturnValue(query);
		query.order.mockResolvedValue({ data: null, error: { code: "42501" } });
		mocks.getSupabaseAdminClient.mockReturnValue({
			from: vi.fn().mockReturnValue(query),
		});

		await expect(readAppRolePermissions("moderator")).rejects.toEqual({
			code: "42501",
		});
	});
});
