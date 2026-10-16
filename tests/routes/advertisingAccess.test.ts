import { describe, expect, it, vi } from "vitest";
vi.mock("$lib/server/advertising/advertising.server", () => ({
	readAdvertisingEligibility: vi.fn(),
}));
vi.mock("$lib/utils/moderation/moderation", () => ({
	getUserAppRole: vi.fn(),
}));
import { getUserAppRole } from "$lib/utils/moderation/moderation";
import { GET } from "../../src/routes/api/advertising/access/+server";
import { readAdvertisingEligibility } from "$lib/server/advertising/advertising.server";

describe("private advertising access endpoint", () => {
	it("refuses anonymous callers without reading membership", async () => {
		vi.mocked(readAdvertisingEligibility).mockClear();
		const result = await GET({
			locals: { getVerifiedUser: async () => null },
		} as never);
		expect(result.status).toBe(401);
		expect(await result.json()).toEqual({ eligibility: "unknown" });
		expect(readAdvertisingEligibility).not.toHaveBeenCalled();
	});
	it.each(["supported", "ad-free", "unknown"] as const)(
		"returns bounded %s state for the verified owner only",
		async (eligibility) => {
			vi.mocked(readAdvertisingEligibility).mockResolvedValue(eligibility);
			const supabase = {};
			const result = await GET({
				locals: {
					getVerifiedUser: async () => ({
						id: "verified-owner",
						appRoleClaim: "user",
					}),
					supabase,
				},
			} as never);
			expect(await result.json()).toEqual({ eligibility });
			expect(result.headers.get("cache-control")).toBe("private, no-store");
			expect(readAdvertisingEligibility).toHaveBeenLastCalledWith({
				supabase,
				userId: "verified-owner",
			});
		},
	);
	it.each([null, "admin"] as const)(
		"resolves a missing verified claim against current role %s",
		async (role) => {
			vi.mocked(readAdvertisingEligibility)
				.mockClear()
				.mockResolvedValue("supported");
			vi.mocked(getUserAppRole).mockResolvedValue(role);
			const result = await GET({
				locals: {
					getVerifiedUser: async () => ({ id: "owner", appRoleClaim: null }),
					supabase: {},
				},
			} as never);
			expect(await result.json()).toEqual({
				eligibility: role === null ? "supported" : "unknown",
			});
			expect(getUserAppRole).toHaveBeenLastCalledWith({}, "owner");
			expect(readAdvertisingEligibility).toHaveBeenCalledTimes(
				role === null ? 1 : 0,
			);
		},
	);
	it("suppresses ads if current role cannot be verified", async () => {
		vi.mocked(readAdvertisingEligibility).mockClear();
		vi.mocked(getUserAppRole).mockRejectedValue(new Error("Unavailable"));
		const result = await GET({
			locals: {
				getVerifiedUser: async () => ({ id: "owner", appRoleClaim: null }),
				supabase: {},
			},
		} as never);
		expect(await result.json()).toEqual({ eligibility: "unknown" });
		expect(readAdvertisingEligibility).not.toHaveBeenCalled();
	});
});
