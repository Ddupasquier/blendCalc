import { describe, expect, it, vi } from "vitest";

const { createServerClient } = vi.hoisted(() => ({
	createServerClient: vi.fn(() => ({ kind: "request-client" })),
}));

vi.mock("$app/env", () => ({ dev: true }));
vi.mock("$app/env/private", async (importOriginal) => {
	const actual = await importOriginal<Record<string, unknown>>();
	const overrides = { BLENDCALC_RUNTIME_ENVIRONMENT: "production" };
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
		PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
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
vi.mock("@supabase/ssr", () => ({ createServerClient }));
vi.mock("ws", () => ({ default: class WebSocketTransport {} }));

import { createSupabaseServerClient } from "$lib/supabase/server";

describe("Supabase request client", () => {
	it("supplies a Node-compatible WebSocket transport", () => {
		const cookies = {
			getAll: vi.fn(() => []),
			set: vi.fn(),
		};

		createSupabaseServerClient(cookies as never);

		expect(createServerClient).toHaveBeenCalledWith(
			"https://example.supabase.co",
			"publishable-key",
			expect.objectContaining({
				realtime: { transport: expect.any(Function) },
			}),
		);
	});
});
