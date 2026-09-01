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
		publicEnvironment.PUBLIC_SITE_URL = "https://www.blendcalc.food/";
		const request = new Request("https://www.blendcalc.food/auth");

		expect(getRequestOrigin(request, new URL(request.url))).toBe(
			"https://www.blendcalc.food",
		);
	});

	it("fails closed for hosted requests without a configured site URL", () => {
		const request = new Request("https://preview.example/auth", {
			headers: {
				"x-forwarded-host": "www.blendcalc.food",
				"x-forwarded-proto": "https",
			},
		});

		expect(() => getRequestOrigin(request, new URL(request.url))).toThrow(
			"PUBLIC_SITE_URL",
		);
	});

	it("builds an exact production callback without dynamic query parameters", () => {
		publicEnvironment.PUBLIC_SITE_URL = "www.blendcalc.food";
		const request = new Request("https://www.blendcalc.food/auth");

		expect(getAuthCallbackUrl(request, new URL(request.url))).toBe(
			"https://www.blendcalc.food/auth/callback",
		);
	});

	it("falls back to localhost during direct local development", () => {
		publicEnvironment.PUBLIC_SITE_URL = "https://www.blendcalc.food";
		const request = new Request("http://localhost:5173/auth");

		expect(getAuthCallbackUrl(request, new URL(request.url))).toBe(
			"http://localhost:5173/auth/callback",
		);
	});

	it("keeps authentication on the exact Vercel preview deployment", () => {
		publicEnvironment.PUBLIC_SITE_URL = "https://www.blendcalc.food";
		privateEnvironment.VERCEL_URL =
			"blendcalc-preview-hash-dylan-dupasquiers-projects.vercel.app";
		const request = new Request(
			"https://blendcalc-preview-hash-dylan-dupasquiers-projects.vercel.app/auth",
		);

		expect(getAuthCallbackUrl(request, new URL(request.url))).toBe(
			"https://blendcalc-preview-hash-dylan-dupasquiers-projects.vercel.app/auth/callback",
		);
		expect(
			getCanonicalAuthPageUrl(
				request,
				new URL(request.url),
				"/ingredients/fridge",
			),
		).toBeNull();
	});

	it("uses Vercel's forwarded preview host when the framework URL is canonical", () => {
		publicEnvironment.PUBLIC_SITE_URL = "https://www.blendcalc.food";
		privateEnvironment.VERCEL_URL =
			"blendcalc-git-feature-ba-f74008-dylan-dupasquiers-projects.vercel.app";
		const request = new Request("https://www.blendcalc.food/auth", {
			headers: {
				"x-forwarded-host":
					"blendcalc-git-feature-ba-f74008-dylan-dupasquiers-projects.vercel.app",
				"x-forwarded-proto": "https",
			},
		});

		expect(getAuthCallbackUrl(request, new URL(request.url))).toBe(
			"https://blendcalc-git-feature-ba-f74008-dylan-dupasquiers-projects.vercel.app/auth/callback",
		);
		expect(getExternalRequestOrigin(request, new URL(request.url))).toBe(
			"https://blendcalc-git-feature-ba-f74008-dylan-dupasquiers-projects.vercel.app",
		);
		expect(
			getCanonicalAuthPageUrl(
				request,
				new URL(request.url),
				"/ingredients/fridge",
			),
		).toBeNull();
	});

	it("ignores an untrusted forwarded host", () => {
		publicEnvironment.PUBLIC_SITE_URL = "https://www.blendcalc.food";
		privateEnvironment.VERCEL_URL =
			"blendcalc-git-feature-ba-f74008-dylan-dupasquiers-projects.vercel.app";
		const request = new Request("https://www.blendcalc.food/auth", {
			headers: {
				"x-forwarded-host": "attacker-project.vercel.app",
				"x-forwarded-proto": "https",
			},
		});

		expect(getAuthCallbackUrl(request, new URL(request.url))).toBe(
			"https://www.blendcalc.food/auth/callback",
		);
	});

	it("keeps authentication on the Vercel branch preview alias", () => {
		publicEnvironment.PUBLIC_SITE_URL = "https://www.blendcalc.food";
		privateEnvironment.VERCEL_BRANCH_URL =
			"blendcalc-git-feature-dylan-dupasquiers-projects.vercel.app";
		const request = new Request(
			"https://blendcalc-git-feature-dylan-dupasquiers-projects.vercel.app/auth",
		);

		expect(getRequestOrigin(request, new URL(request.url))).toBe(
			"https://blendcalc-git-feature-dylan-dupasquiers-projects.vercel.app",
		);
	});

	it("does not trust an unrelated Vercel deployment host", () => {
		publicEnvironment.PUBLIC_SITE_URL = "https://www.blendcalc.food";
		privateEnvironment.VERCEL_URL =
			"blendcalc-preview-hash-dylan-dupasquiers-projects.vercel.app";
		const request = new Request("https://attacker-project.vercel.app/auth");

		expect(getRequestOrigin(request, new URL(request.url))).toBe(
			"https://www.blendcalc.food",
		);
	});

	it("redirects alternate hosted domains to the canonical auth page", () => {
		publicEnvironment.PUBLIC_SITE_URL = "https://www.blendcalc.food";
		const request = new Request("https://preview.example/auth");

		expect(
			getCanonicalAuthPageUrl(
				request,
				new URL(request.url),
				"/mix?loaded=true",
			),
		).toBe("https://www.blendcalc.food/auth?next=%2Fmix%3Floaded%3Dtrue");
	});

	it("keeps the legacy production alias as a canonical-auth entry point", () => {
		publicEnvironment.PUBLIC_SITE_URL = "https://www.blendcalc.food";
		const request = new Request("https://blendcalc.vercel.app/auth");

		expect(
			getCanonicalAuthPageUrl(
				request,
				new URL(request.url),
				"/ingredients/fridge",
			),
		).toBe("https://www.blendcalc.food/auth?next=%2Fingredients%2Ffridge");
	});
});
