import { describe, expect, it, vi } from "vitest";
import type { Cookies } from "@sveltejs/kit";
import {
	clearPasswordUpgrade,
	getPasswordUpgradeNext,
	requirePasswordUpgrade,
} from "$lib/utils/auth/passwordUpgrade";

const createCookies = (initialValue?: string) => {
	let value = initialValue;
	const cookies = {
		get: vi.fn(() => value),
		set: vi.fn((_name: string, nextValue: string) => {
			value = nextValue;
		}),
		delete: vi.fn(() => {
			value = undefined;
		}),
	} as unknown as Cookies;
	return cookies;
};

describe("password upgrade marker", () => {
	it("stores a secure HTTP-only marker with a safe return path", () => {
		const cookies = createCookies();

		requirePasswordUpgrade(cookies, "/mix?loaded=1", true);

		expect(cookies.set).toHaveBeenCalledWith(
			"sm-password-upgrade",
			"/mix?loaded=1",
			expect.objectContaining({
				httpOnly: true,
				path: "/",
				sameSite: "lax",
				secure: true,
			}),
		);
		expect(getPasswordUpgradeNext(cookies)).toBe("/mix?loaded=1");
	});

	it("rejects an external return URL and clears the marker", () => {
		const cookies = createCookies("https://example.com");

		expect(getPasswordUpgradeNext(cookies)).toBe("/");
		clearPasswordUpgrade(cookies);

		expect(cookies.delete).toHaveBeenCalledWith("sm-password-upgrade", {
			path: "/",
		});
		expect(getPasswordUpgradeNext(cookies)).toBeNull();
	});
});
