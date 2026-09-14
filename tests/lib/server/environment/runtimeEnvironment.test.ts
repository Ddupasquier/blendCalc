import { describe, expect, it } from "vitest";
import {
	assertExternalRequestAllowed,
	assertRuntimeUrlMatchesEnvironment,
	isDisposableDatabaseRuntimeEnvironment,
	readBlendCalcRuntimeEnvironment,
} from "$lib/server/environment/runtimeEnvironment.server";

describe("BlendCalc runtime environment", () => {
	it("identifies the runtimes whose database resets invalidate browser sessions", () => {
		expect(isDisposableDatabaseRuntimeEnvironment("test")).toBe(true);
		expect(isDisposableDatabaseRuntimeEnvironment("rehearsal")).toBe(true);
		expect(isDisposableDatabaseRuntimeEnvironment("local")).toBe(false);
		expect(isDisposableDatabaseRuntimeEnvironment("staging")).toBe(false);
		expect(isDisposableDatabaseRuntimeEnvironment("production")).toBe(false);
		expect(isDisposableDatabaseRuntimeEnvironment(undefined)).toBe(false);
	});

	it.each(["local", "test", "rehearsal", "staging", "production"] as const)(
		"accepts the explicit %s runtime",
		(runtimeEnvironment) => {
			expect(
				readBlendCalcRuntimeEnvironment({
					BLENDCALC_RUNTIME_ENVIRONMENT: runtimeEnvironment,
				}),
			).toBe(runtimeEnvironment);
		},
	);

	it("infers only well-known hosted and Node runtimes", () => {
		expect(readBlendCalcRuntimeEnvironment({ VERCEL_ENV: "production" })).toBe(
			"production",
		);
		expect(readBlendCalcRuntimeEnvironment({ VERCEL_ENV: "preview" })).toBe(
			"staging",
		);
		expect(readBlendCalcRuntimeEnvironment({ NODE_ENV: "development" })).toBe(
			"local",
		);
	});

	it("fails closed for an invalid or unidentified runtime", () => {
		expect(() =>
			readBlendCalcRuntimeEnvironment({
				BLENDCALC_RUNTIME_ENVIRONMENT: "prodution",
			}),
		).toThrow("BLENDCALC_RUNTIME_ENVIRONMENT is invalid.");
		expect(() => readBlendCalcRuntimeEnvironment({})).toThrow(
			"BLENDCALC_RUNTIME_ENVIRONMENT is not configured.",
		);
	});

	it.each(["local", "test", "rehearsal"] as const)(
		"rejects hosted database and request targets in %s",
		(runtimeEnvironment) => {
			expect(() =>
				assertRuntimeUrlMatchesEnvironment(
					"database",
					"https://example.supabase.co",
					runtimeEnvironment,
				),
			).toThrow("database must use a loopback URL");
			expect(() =>
				assertExternalRequestAllowed(
					"https://api.nal.usda.gov/fdc/v1/foods",
					runtimeEnvironment,
				),
			).toThrow("External network requests are disabled");
		},
	);

	it("permits local targets in safe runtimes and hosted targets in production", () => {
		expect(() =>
			assertRuntimeUrlMatchesEnvironment(
				"database",
				"http://127.0.0.1:54321",
				"test",
			),
		).not.toThrow();
		expect(() =>
			assertExternalRequestAllowed(
				"https://api.nal.usda.gov/fdc/v1/foods",
				"production",
			),
		).not.toThrow();
	});
});
