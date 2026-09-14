import { describe, expect, it } from "vitest";
import {
	assertLoadedRehearsalStorageImage,
	assertRehearsalContentSecurityPolicy,
	parseContentSecurityPolicy,
} from "../../scripts/lib/rehearsal/application_proof.mjs";

const rehearsalCsp = [
	"default-src 'self'",
	"frame-src 'self'",
	"worker-src 'self' blob:",
	"connect-src 'self' http://127.0.0.1:58321 ws://127.0.0.1:58321 http://127.0.0.1:55321 ws://127.0.0.1:55321 https://images.openfoodfacts.org",
	"font-src 'self' data:",
	"img-src 'self' data: blob: http://127.0.0.1:58321 https://images.openfoodfacts.org",
	"object-src 'none'",
	"script-src 'self' 'wasm-unsafe-eval' 'nonce-proof'",
	"style-src 'self' 'unsafe-inline'",
	"base-uri 'self'",
	"form-action 'self'",
	"frame-ancestors 'none'",
].join("; ");

const endpoints = {
	applicationSupabaseUrl: "http://127.0.0.1:58321",
	blendCalcAPIUrl: "http://127.0.0.1:55321",
};

describe("Rehearsal application proof", () => {
	it("parses the policy into individually inspectable directives", () => {
		const directives = parseContentSecurityPolicy(rehearsalCsp);

		expect(directives.get("img-src")).toEqual([
			"'self'",
			"data:",
			"blob:",
			"http://127.0.0.1:58321",
			"https://images.openfoodfacts.org",
		]);
	});

	it("accepts only the exact Rehearsal origins in their owning directives", () => {
		expect(() =>
			assertRehearsalContentSecurityPolicy(rehearsalCsp, endpoints),
		).not.toThrow();
	});

	it("rejects a Supabase origin that appears only in connect-src", () => {
		const wrongImagePolicy = rehearsalCsp.replace(
			"img-src 'self' data: blob: http://127.0.0.1:58321 https://images.openfoodfacts.org",
			"img-src 'self' data: blob: https://images.openfoodfacts.org",
		);

		expect(() =>
			assertRehearsalContentSecurityPolicy(wrongImagePolicy, endpoints),
		).toThrow("img-src sources are not exact");
	});

	it.each([
		["broad HTTP", "img-src 'self' data: blob: http:"],
		[
			"ordinary local database",
			"img-src 'self' data: blob: http://127.0.0.1:54321",
		],
		["hosted Supabase", "img-src 'self' data: blob: https://*.supabase.co"],
	])("rejects %s image access", (_label, wrongDirective) => {
		const unsafePolicy = rehearsalCsp.replace(
			"img-src 'self' data: blob: http://127.0.0.1:58321 https://images.openfoodfacts.org",
			wrongDirective,
		);

		expect(() =>
			assertRehearsalContentSecurityPolicy(unsafePolicy, endpoints),
		).toThrow("img-src sources are not exact");
	});

	it("requires a completed signed Storage image with real dimensions", () => {
		const loaded = assertLoadedRehearsalStorageImage(
			[
				{
					origin: "https://images.openfoodfacts.org",
					pathname: "/images/example.jpg",
					complete: true,
					naturalWidth: 320,
					naturalHeight: 240,
				},
				{
					origin: "http://127.0.0.1:58321",
					pathname: "/storage/v1/object/sign/profile-avatars/person/avatar.png",
					complete: true,
					naturalWidth: 655,
					naturalHeight: 446,
				},
			],
			{ ...endpoints, bucket: "profile-avatars" },
		);

		expect(loaded.naturalWidth).toBe(655);
	});

	it("rejects a blocked or zero-size local Storage image", () => {
		expect(() =>
			assertLoadedRehearsalStorageImage(
				[
					{
						origin: "http://127.0.0.1:58321",
						pathname:
							"/storage/v1/object/sign/profile-avatars/person/avatar.png",
						complete: true,
						naturalWidth: 0,
						naturalHeight: 0,
					},
				],
				{ ...endpoints, bucket: "profile-avatars" },
			),
		).toThrow("did not load at nonzero dimensions");
	});
});
