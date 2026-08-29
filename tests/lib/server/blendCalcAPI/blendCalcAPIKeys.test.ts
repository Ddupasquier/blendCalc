import { describe, expect, it, vi } from "vitest";
import {
	issueBlendCalcAPIKey,
	rotateBlendCalcAPIKey,
} from "$lib/server/blendCalcAPI/security/blendCalcAPIKeys.server";
import type { Database } from "$lib/types/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("$lib/server/runtime/backgroundTask.server", () => ({
	completeServerBackgroundTask: async (task: Promise<unknown>) => await task,
}));

describe("blendCalcAPI key lifecycle", () => {
	it("returns a plaintext key once while persisting only its hash and prefix", async () => {
		const insert = vi.fn().mockResolvedValue({ error: null });
		const supabase = {
			from: () => ({ insert }),
		} as unknown as SupabaseClient<Database>;
		const issued = await issueBlendCalcAPIKey({
			supabase,
			clientId: "11111111-1111-4111-8111-111111111111",
			name: "Local integration",
			scopes: ["catalog.read", "catalog.read"],
			environment: "test",
		});

		expect(issued.key).toMatch(/^bc_test_[A-Za-z0-9_-]{43}$/);
		expect(issued.scopes).toEqual(["catalog.read"]);
		expect(insert).toHaveBeenCalledWith(
			expect.objectContaining({
				key_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
				key_prefix: expect.stringMatching(/^bc_test_/),
			}),
		);
		expect(JSON.stringify(insert.mock.calls)).not.toContain(issued.key);
	});

	it("uses the atomic database rotation boundary", async () => {
		const rpc = vi.fn().mockResolvedValue({ error: null });
		const supabase = { rpc } as unknown as SupabaseClient<Database>;
		const rotated = await rotateBlendCalcAPIKey({
			supabase,
			currentKeyId: "22222222-2222-4222-8222-222222222222",
			clientId: "11111111-1111-4111-8111-111111111111",
			name: "Rotated integration",
			scopes: ["catalog.read"],
			environment: "live",
		});

		expect(rotated.key).toMatch(/^bc_live_/);
		expect(rpc).toHaveBeenCalledWith(
			"rotate_blendcalc_api_key",
			expect.objectContaining({
				p_current_key_id: "22222222-2222-4222-8222-222222222222",
				p_key_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
			}),
		);
	});
});
