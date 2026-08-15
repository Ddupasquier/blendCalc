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

	it("keeps profile reads usable before the optional preference column rolls out", async () => {
		const maybeSingle = vi.fn()
			.mockResolvedValueOnce({
				data: null,
				error: {
					code: "PGRST204",
					message: "Could not find the 'cheeky_messages_enabled' column",
				},
			})
			.mockResolvedValueOnce({
				data: {
					user_id: "user-1",
					display_name: "Test User",
					bio: null,
					appearance_theme: "system",
					avatar_path: null,
					avatar_alt_text: null,
					avatar_moderation_status: "not_submitted",
					avatar_policy_acknowledged_at: null,
					created_at: "2026-08-15T00:00:00Z",
					updated_at: "2026-08-15T00:00:00Z",
				},
				error: null,
			});
		const eq = vi.fn(() => ({ maybeSingle }));
		const select = vi.fn(() => ({ eq }));
		const supabase = {
			from: vi.fn(() => ({ select })),
		} as unknown as SupabaseClient<Database>;

		await expect(getUserProfile(supabase, "user-1")).resolves.toMatchObject({
			cheeky_messages_enabled: false,
		});
		expect(select).toHaveBeenCalledTimes(2);
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
