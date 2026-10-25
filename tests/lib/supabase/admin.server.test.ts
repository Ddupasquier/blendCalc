import { describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({
	createClient: vi.fn(() => ({ kind: "admin-client" })),
}));

vi.mock("$app/env/private", async (importOriginal) => {
	const actual = await importOriginal<Record<string, unknown>>();
	const overrides = {
		BLENDCALC_RUNTIME_ENVIRONMENT: "production",
		SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
	};
	return new Proxy(actual, {
		get(target, key) {
			return Reflect.has(overrides, key)
				? Reflect.get(overrides, key)
				: Reflect.get(target, key);
		},
	});
});
vi.mock("$app/env/public", async (importOriginal) => {
	const actual = await importOriginal<Record<string, unknown>>();
	const overrides = {
		PUBLIC_SUPABASE_URL: "https://example.supabase.co",
	};
	return new Proxy(actual, {
		get(target, key) {
			return Reflect.has(overrides, key)
				? Reflect.get(overrides, key)
				: Reflect.get(target, key);
		},
	});
});
vi.mock("@supabase/supabase-js", () => ({ createClient }));
vi.mock("ws", () => ({ default: class WebSocketTransport {} }));

import { getSupabaseAdminClient } from "$lib/supabase/admin.server";

describe("Supabase admin client", () => {
	it("reuses one client and supplies the Node WebSocket transport", () => {
		const firstClient = getSupabaseAdminClient();
		const secondClient = getSupabaseAdminClient();

		expect(secondClient).toBe(firstClient);
		expect(createClient).toHaveBeenCalledTimes(1);
		expect(createClient).toHaveBeenCalledWith(
			"https://example.supabase.co",
			"service-role-key",
			expect.objectContaining({
				realtime: { transport: expect.any(Function) },
			}),
		);
	});
});
