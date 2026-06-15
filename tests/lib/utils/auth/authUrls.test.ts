import { beforeEach, describe, expect, it, vi } from "vitest";

const publicEnvironment = vi.hoisted(() => ({
	PUBLIC_SITE_URL: "",
}));

const privateEnvironment = vi.hoisted(() => ({
	VERCEL_URL: "",
	VERCEL_BRANCH_URL: "",
	VERCEL_PROJECT_PRODUCTION_URL: "",
}));

vi.mock("$env/dynamic/public", () => ({ env: publicEnvironment }));
vi.mock("$env/dynamic/private", () => ({ env: privateEnvironment }));

import {
	getAuthCallbackUrl,
	getCanonicalAuthPageUrl,
	getExternalRequestOrigin,
	getRequestOrigin,
} from "$lib/utils/auth/authUrls";

describe("authentication URLs", () => {
	beforeEach(() => {
		publicEnvironment.PUBLIC_SITE_URL = "";
		privateEnvironment.VERCEL_URL = "";
		privateEnvironment.VERCEL_BRANCH_URL = "";
		privateEnvironment.VERCEL_PROJECT_PRODUCTION_URL = "";
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

	it("keeps authentication on the exact Vercel preview deployment", () => {
		publicEnvironment.PUBLIC_SITE_URL = "https://smoothie-mixer.vercel.app";
		privateEnvironment.VERCEL_URL =
			"smoothie-mixer-preview-hash-dylan-dupasquiers-projects.vercel.app";
		const request = new Request(
			"https://smoothie-mixer-preview-hash-dylan-dupasquiers-projects.vercel.app/auth",
		);

		expect(getAuthCallbackUrl(request, new URL(request.url))).toBe(
			"https://smoothie-mixer-preview-hash-dylan-dupasquiers-projects.vercel.app/auth/callback",
		);
		expect(
			getCanonicalAuthPageUrl(request, new URL(request.url), "/fridge"),
		).toBeNull();
	});

	it("uses Vercel's forwarded preview host when the framework URL is canonical", () => {
		publicEnvironment.PUBLIC_SITE_URL = "https://smoothie-mixer.vercel.app";
		privateEnvironment.VERCEL_URL =
			"smoothie-mixer-git-feature-ba-f74008-dylan-dupasquiers-projects.vercel.app";
		const request = new Request("https://smoothie-mixer.vercel.app/auth", {
			headers: {
				"x-forwarded-host":
					"smoothie-mixer-git-feature-ba-f74008-dylan-dupasquiers-projects.vercel.app",
				"x-forwarded-proto": "https",
			},
		});

		expect(getAuthCallbackUrl(request, new URL(request.url))).toBe(
			"https://smoothie-mixer-git-feature-ba-f74008-dylan-dupasquiers-projects.vercel.app/auth/callback",
		);
		expect(getExternalRequestOrigin(request, new URL(request.url))).toBe(
			"https://smoothie-mixer-git-feature-ba-f74008-dylan-dupasquiers-projects.vercel.app",
		);
		expect(
			getCanonicalAuthPageUrl(request, new URL(request.url), "/fridge"),
		).toBeNull();
	});

	it("ignores an untrusted forwarded host", () => {
		publicEnvironment.PUBLIC_SITE_URL = "https://smoothie-mixer.vercel.app";
		privateEnvironment.VERCEL_URL =
			"smoothie-mixer-git-feature-ba-f74008-dylan-dupasquiers-projects.vercel.app";
		const request = new Request("https://smoothie-mixer.vercel.app/auth", {
			headers: {
				"x-forwarded-host": "attacker-project.vercel.app",
				"x-forwarded-proto": "https",
			},
		});

		expect(getAuthCallbackUrl(request, new URL(request.url))).toBe(
			"https://smoothie-mixer.vercel.app/auth/callback",
		);
	});

	it("keeps authentication on the Vercel branch preview alias", () => {
		publicEnvironment.PUBLIC_SITE_URL = "https://smoothie-mixer.vercel.app";
		privateEnvironment.VERCEL_BRANCH_URL =
			"smoothie-mixer-git-feature-dylan-dupasquiers-projects.vercel.app";
		const request = new Request(
			"https://smoothie-mixer-git-feature-dylan-dupasquiers-projects.vercel.app/auth",
		);

		expect(getRequestOrigin(request, new URL(request.url))).toBe(
			"https://smoothie-mixer-git-feature-dylan-dupasquiers-projects.vercel.app",
		);
	});

	it("does not trust an unrelated Vercel deployment host", () => {
		publicEnvironment.PUBLIC_SITE_URL = "https://smoothie-mixer.vercel.app";
		privateEnvironment.VERCEL_URL =
			"smoothie-mixer-preview-hash-dylan-dupasquiers-projects.vercel.app";
		const request = new Request("https://attacker-project.vercel.app/auth");

		expect(getRequestOrigin(request, new URL(request.url))).toBe(
			"https://smoothie-mixer.vercel.app",
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
