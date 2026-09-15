import { getLocalSupabaseAuthCookieName } from "$lib/supabase/authCookie";
import { describe, expect, it } from "vitest";

describe("Supabase Auth cookie ownership", () => {
	it("isolates disposable local Auth services by port", () => {
		expect(getLocalSupabaseAuthCookieName("http://127.0.0.1:54321")).toBe(
			"blendcalc-local-54321-auth-token",
		);
		expect(getLocalSupabaseAuthCookieName("http://127.0.0.1:58321")).toBe(
			"blendcalc-local-58321-auth-token",
		);
	});

	it("uses the Supabase default cookie contract for hosted services", () => {
		expect(
			getLocalSupabaseAuthCookieName("https://project-ref.supabase.co"),
		).toBeUndefined();
	});
});
