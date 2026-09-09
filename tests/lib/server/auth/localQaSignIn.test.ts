import { describe, expect, it } from "vitest";
import {
	getLocalQaBrowserRateLimitClientAddress,
	getLocalQaSignInCredentials,
	getLocalQaSignInPageData,
} from "../../../../src/lib/server/auth/localQaSignIn.server";

const localAccounts = [
	["user", "QA User", "qa-user@blendcalc.local", "user"],
	[
		"browserWorker1",
		"QA Browser Worker 1",
		"qa-browser-1@blendcalc.local",
		"user",
	],
	[
		"browserWorker2",
		"QA Browser Worker 2",
		"qa-browser-2@blendcalc.local",
		"user",
	],
	[
		"browserWorker3",
		"QA Browser Worker 3",
		"qa-browser-3@blendcalc.local",
		"user",
	],
	["preferences", "QA Food Warnings", "qa-preferences@blendcalc.local", "user"],
	["empty", "QA Empty State", "qa-empty@blendcalc.local", "user"],
	["onboarding", "QA Guided Tour", "qa-onboarding@blendcalc.local", "user"],
	["moderator", "QA Moderator", "qa-moderator@blendcalc.local", "moderator"],
	["admin", "QA Admin", "qa-admin@blendcalc.local", "admin"],
	["developer", "QA Developer", "qa-developer@blendcalc.local", "developer"],
].map(([key, displayName, email, role]) => ({
	key,
	displayName,
	email,
	role,
	purpose: `Purpose for ${displayName}`,
}));

const localRuntime = {
	appUrl: new URL("http://localhost:5174/auth"),
	databaseEnvironment: "test",
	supabaseUrl: "http://127.0.0.1:54321",
	password: "disposable-local-password",
	accountsBase64: Buffer.from(JSON.stringify(localAccounts)).toString("base64"),
};

describe("local QA sign-in boundary", () => {
	it("offers every maintained QA persona without serializing its password", () => {
		const pageData = getLocalQaSignInPageData(localRuntime);

		expect(pageData?.accounts.map(({ key }) => key)).toEqual([
			"user",
			"browserWorker1",
			"browserWorker2",
			"browserWorker3",
			"preferences",
			"empty",
			"onboarding",
			"moderator",
			"admin",
			"developer",
		]);
		expect(JSON.stringify(pageData)).not.toContain("disposable-local-password");
		expect(pageData?.accounts).toContainEqual(
			expect.objectContaining({
				key: "user",
				email: "qa-user@blendcalc.local",
				role: "user",
			}),
		);
	});

	it.each([
		[
			"ordinary local development",
			{ appUrl: new URL("http://localhost:5173/auth") },
		],
		["a hosted app", { appUrl: new URL("https://www.blendcalc.food/auth") }],
		["a hosted database", { supabaseUrl: "https://example.supabase.co" }],
		["a non-test database mode", { databaseEnvironment: "production" }],
		["a missing generated password", { password: "" }],
		["missing generated accounts", { accountsBase64: "" }],
		["malformed generated accounts", { accountsBase64: "not-json" }],
	])("stays unavailable in %s", (_name, override) => {
		expect(
			getLocalQaSignInPageData({ ...localRuntime, ...override }),
		).toBeNull();
	});

	it("resolves only a maintained account after the local runtime guard passes", () => {
		expect(getLocalQaSignInCredentials("moderator", localRuntime)).toEqual({
			email: "qa-moderator@blendcalc.local",
			password: "disposable-local-password",
		});
		expect(getLocalQaSignInCredentials("unknown", localRuntime)).toBeNull();
		expect(
			getLocalQaSignInCredentials("moderator", {
				...localRuntime,
				appUrl: new URL("https://staging.example.com/auth"),
			}),
		).toBeNull();
	});

	it("partitions local browser quota only for a maintained QA worker and project", () => {
		expect(
			getLocalQaBrowserRateLimitClientAddress(
				"browserWorker2|desktop-webkit",
				localRuntime,
			),
		).toBe("local-qa-browser:desktop-webkit:browserWorker2");
		expect(
			getLocalQaBrowserRateLimitClientAddress(
				"unknown-worker|desktop-webkit",
				localRuntime,
			),
		).toBeNull();
		expect(
			getLocalQaBrowserRateLimitClientAddress(
				"browserWorker2|unknown-project",
				localRuntime,
			),
		).toBeNull();
		expect(
			getLocalQaBrowserRateLimitClientAddress("browserWorker2|desktop-webkit", {
				...localRuntime,
				appUrl: new URL("https://www.blendcalc.food/auth"),
			}),
		).toBeNull();
	});
});
