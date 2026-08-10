import type { Database } from "$lib/types/database.types";
import {
	getSignedAvatarUrl,
	getUserProfile,
} from "$lib/utils/profile/profile";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

describe("profile request efficiency", () => {
	it("selects named profile columns", async () => {
		const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
		const eq = vi.fn(() => ({ maybeSingle }));
		const select = vi.fn(() => ({ eq }));
		const supabase = {
			from: vi.fn(() => ({ select })),
		} as unknown as SupabaseClient<Database>;

		await expect(getUserProfile(supabase, "user-1")).resolves.toBeNull();
		expect(select).toHaveBeenCalledWith(expect.not.stringContaining("*"));
	});

	it("coalesces and caches repeated avatar signing requests", async () => {
		const createSignedUrl = vi.fn().mockResolvedValue({
			data: { signedUrl: "https://example.com/avatar" },
			error: null,
		});
		const supabase = {
			storage: { from: vi.fn(() => ({ createSignedUrl })) },
		} as unknown as SupabaseClient<Database>;
		const avatarPath = `user/avatar-${Date.now()}.png`;

		await expect(Promise.all([
			getSignedAvatarUrl(supabase, avatarPath),
			getSignedAvatarUrl(supabase, avatarPath),
		])).resolves.toEqual([
			"https://example.com/avatar",
			"https://example.com/avatar",
		]);
		await expect(getSignedAvatarUrl(supabase, avatarPath)).resolves.toBe(
			"https://example.com/avatar",
		);
		expect(createSignedUrl).toHaveBeenCalledTimes(1);
	});
});
