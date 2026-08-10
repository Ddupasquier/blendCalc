import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { POST } from "../../src/routes/auth/logout/+server";

const profilePage = readFileSync("src/routes/profile/+page.svelte", "utf8");
const profileSessionSettings = readFileSync(
	"src/lib/components/profile/ProfileSessionSettings/ProfileSessionSettings.svelte",
	"utf8",
);

const createEvent = (signOutError: unknown = null) => {
	const signOut = vi.fn().mockResolvedValue({ error: signOutError });
	const cookies = {
		delete: vi.fn(),
	};

	return {
		event: {
			locals: {
				supabase: {
					auth: { signOut },
				},
			},
			cookies,
		},
		signOut,
		cookies,
	};
};

describe("logout route", () => {
	it("is exposed from Profile through the shared button primitive", () => {
		expect(profilePage).toContain("ProfileSessionSettings");
		expect(profileSessionSettings).toContain("RoundedActionButton");
		expect(profileSessionSettings).toContain('action="/auth/logout"');
		expect(profileSessionSettings).toContain("Log out");
	});

	it("signs out, clears password-upgrade state, and redirects home", async () => {
		const { event, signOut, cookies } = createEvent();

		await expect(POST(event as never)).rejects.toMatchObject({
			status: 303,
			location: "/",
		});

		expect(signOut).toHaveBeenCalledOnce();
		expect(cookies.delete).toHaveBeenCalledWith("sm-password-upgrade", {
			path: "/",
		});
	});

	it("still clears local upgrade state when the provider sign-out call fails", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const { event, cookies } = createEvent({
			code: "request_failed",
			status: 503,
		});

		await expect(POST(event as never)).rejects.toMatchObject({
			status: 303,
			location: "/",
		});

		expect(cookies.delete).toHaveBeenCalledWith("sm-password-upgrade", {
			path: "/",
		});
		expect(warn).toHaveBeenCalledWith("[auth] Sign out failed", {
			code: "request_failed",
			status: 503,
		});
		warn.mockRestore();
	});
});
