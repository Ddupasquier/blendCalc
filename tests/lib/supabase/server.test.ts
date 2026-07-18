import { describe, expect, it, vi } from "vitest";

const { createServerClient } = vi.hoisted(() => ({
	createServerClient: vi.fn(() => ({ kind: "request-client" })),
}));

vi.mock("$app/environment", () => ({ dev: true }));
vi.mock("$env/static/public", () => ({
	PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
	PUBLIC_SUPABASE_URL: "https://example.supabase.co",
}));
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
