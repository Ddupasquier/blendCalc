import { beforeEach, describe, expect, it, vi } from "vitest";

const publicEnvironment = vi.hoisted(() => ({
	PUBLIC_SITE_URL: "",
}));

vi.mock("$env/dynamic/public", () => ({ env: publicEnvironment }));

import {
	getAuthCallbackUrl,
	getCanonicalAuthPageUrl,
	getRequestOrigin,
} from "$lib/utils/auth/authUrls";

describe("authentication URLs", () => {
	beforeEach(() => {
		publicEnvironment.PUBLIC_SITE_URL = "";
	});

	it("uses the configured production site URL for hosted requests", () => {
		publicEnvironment.PUBLIC_SITE_URL = "https://smoothie-mixer.vercel.app/";
		const request = new Request("https://smoothie-mixer.vercel.app/auth");

		expect(getRequestOrigin(request, new URL(request.url))).toBe(
			"https://smoothie-mixer.vercel.app",
		);
	});

	it("fails closed for hosted requests without a configured site URL", () => {
		const request = new Request("https://preview.example/auth", {
			headers: {
				"x-forwarded-host": "smoothie-mixer.vercel.app",
				"x-forwarded-proto": "https",
			},
		});

		expect(() => getRequestOrigin(request, new URL(request.url))).toThrow(
			"PUBLIC_SITE_URL",
		);
	});

	it("builds an exact production callback without dynamic query parameters", () => {
		publicEnvironment.PUBLIC_SITE_URL = "smoothie-mixer.vercel.app";
		const request = new Request("https://smoothie-mixer.vercel.app/auth");

		expect(getAuthCallbackUrl(request, new URL(request.url))).toBe(
			"https://smoothie-mixer.vercel.app/auth/callback",
		);
	});

	it("falls back to localhost during direct local development", () => {
		publicEnvironment.PUBLIC_SITE_URL = "https://smoothie-mixer.vercel.app";
		const request = new Request("http://localhost:5173/auth");

		expect(getAuthCallbackUrl(request, new URL(request.url))).toBe(
			"http://localhost:5173/auth/callback",
		);
	});

	it("redirects alternate hosted domains to the canonical auth page", () => {
		publicEnvironment.PUBLIC_SITE_URL = "https://smoothie-mixer.vercel.app";
		const request = new Request("https://preview.example/auth");

		expect(
			getCanonicalAuthPageUrl(request, new URL(request.url), "/mix?loaded=true"),
		).toBe(
			"https://smoothie-mixer.vercel.app/auth?next=%2Fmix%3Floaded%3Dtrue",
		);
	});
});
