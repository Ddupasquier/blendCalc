import type { Database } from "$lib/types/database.types";
import { readVerifiedAuthUser } from "$lib/server/auth/verifiedAuthUser.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

describe("readVerifiedAuthUser", () => {
	it("builds the app user from locally verified JWT claims", async () => {
		const getClaims = vi.fn().mockResolvedValue({
			data: {
				claims: {
					sub: "user-1",
					email: "person@example.com",
					app_metadata: { provider: "email" },
					user_metadata: { display_name: "Person" },
				},
			},
			error: null,
		});
		const supabase = { auth: { getClaims } } as unknown as SupabaseClient<Database>;

		await expect(readVerifiedAuthUser(supabase)).resolves.toEqual({
			id: "user-1",
			email: "person@example.com",
			app_metadata: { provider: "email" },
			user_metadata: { display_name: "Person" },
		});
		expect(getClaims).toHaveBeenCalledTimes(1);
	});

	it("rejects missing or unverified claims", async () => {
		const supabase = {
			auth: {
				getClaims: vi.fn().mockResolvedValue({
					data: null,
					error: new Error("invalid token"),
				}),
			},
		} as unknown as SupabaseClient<Database>;

		await expect(readVerifiedAuthUser(supabase)).resolves.toBeNull();
	});
});
