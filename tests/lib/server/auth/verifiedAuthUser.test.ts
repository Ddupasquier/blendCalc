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
					app_role: "moderator",
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
			appRoleClaim: "moderator",
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

	it("checks the current Auth record when destructive test resets can stale the JWT", async () => {
		const getClaims = vi.fn();
		const getUser = vi.fn().mockResolvedValue({
			data: {
				user: {
					id: "current-user",
					email: "qa-user@blendcalc.local",
					app_metadata: { provider: "email" },
					user_metadata: { display_name: "QA User" },
				},
			},
			error: null,
		});
		const supabase = {
			auth: { getClaims, getUser },
		} as unknown as SupabaseClient<Database>;

		await expect(
			readVerifiedAuthUser(supabase, { requireCurrentAuthRecord: true }),
		).resolves.toEqual({
			id: "current-user",
			email: "qa-user@blendcalc.local",
			app_metadata: { provider: "email" },
			user_metadata: { display_name: "QA User" },
			appRoleClaim: null,
		});
		expect(getUser).toHaveBeenCalledTimes(1);
		expect(getClaims).not.toHaveBeenCalled();
	});

	it("rejects a JWT whose Auth user was removed by a test reset", async () => {
		const supabase = {
			auth: {
				getUser: vi.fn().mockResolvedValue({
					data: { user: null },
					error: new Error("User from sub claim in JWT does not exist"),
				}),
			},
		} as unknown as SupabaseClient<Database>;

		await expect(
			readVerifiedAuthUser(supabase, { requireCurrentAuthRecord: true }),
		).resolves.toBeNull();
	});
});
