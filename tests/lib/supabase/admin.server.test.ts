import { describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({
	createClient: vi.fn(() => ({ kind: "admin-client" })),
}));

vi.mock("$env/dynamic/private", () => ({
	env: { SUPABASE_SERVICE_ROLE_KEY: "service-role-key" },
}));
vi.mock("$env/static/public", () => ({
	PUBLIC_SUPABASE_URL: "https://example.supabase.co",
}));
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
