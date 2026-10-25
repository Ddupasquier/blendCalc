import { beforeEach, describe, expect, it, vi } from "vitest";
const settings = vi.hoisted(() => ({
	environment: {} as Record<string, string>,
	runtime: "test",
}));
vi.mock("$app/env/private", async (importOriginal) => {
	const actual = await importOriginal<Record<string, unknown>>();
	const overrides = settings.environment;
	return new Proxy(actual, {
		get(target, key) {
			return Reflect.has(overrides, key)
				? Reflect.get(overrides, key)
				: Reflect.get(target, key);
		},
	});
});
vi.mock("$lib/server/environment/runtimeEnvironment.server", () => ({
	readBlendCalcRuntimeEnvironment: () => settings.runtime,
}));
import {
	readAdvertisingConfiguration,
	readAdvertisingEligibility,
} from "$lib/server/advertising/advertising.server";

describe("server-owned advertising access", () => {
	beforeEach(() => {
		settings.runtime = "test";
		for (const key of Object.keys(settings.environment))
			delete settings.environment[key];
	});
	it.each(["supported", "ad-free"])(
		"accepts only verified RPC result %s",
		async (value) => {
			const abortSignal = vi
				.fn()
				.mockResolvedValue({ data: value, error: null });
			const rpc = vi.fn(() => ({ abortSignal }));
			expect(
				await readAdvertisingEligibility({
					supabase: { rpc },
					userId: "verified-user",
				} as never),
			).toBe(value);
			expect(rpc).toHaveBeenCalledWith("read_current_user_advertising_access");
		},
	);
	it.each([null, "paid", true, { eligibility: "supported" }])(
		"rejects malformed RPC result %j",
		async (value) => {
			const supabase = {
				rpc: () => ({
					abortSignal: async () => ({ data: value, error: null }),
				}),
			};
			expect(
				await readAdvertisingEligibility({
					supabase,
					userId: "verified-user",
				} as never),
			).toBe("unknown");
		},
	);
	it("does not turn missing schema or database failure into ad-supported status", async () => {
		const supabase = {
			rpc: () => ({
				abortSignal: async () => ({
					data: "supported",
					error: { code: "PGRST202" },
				}),
			}),
		};
		expect(
			await readAdvertisingEligibility({
				supabase,
				userId: "verified-user",
			} as never),
		).toBe("unknown");
		expect(
			await readAdvertisingEligibility({
				supabase: {
					rpc: () => {
						throw new Error();
					},
				},
				userId: "verified-user",
			} as never),
		).toBe("unknown");
	});
	it.each(["local", "test", "rehearsal", "staging"])(
		"cannot enable Google in %s",
		(runtime) => {
			settings.runtime = runtime;
			Object.assign(settings.environment, {
				BLENDCALC_RUNTIME_ENVIRONMENT: runtime,
				BLENDCALC_ADVERTISING_MODE: "google",
				BLENDCALC_ADVERTISING_APPROVED: "true",
			});
			expect(readAdvertisingConfiguration()).toEqual({ mode: "disabled" });
		},
	);
	it("requires two deliberate production activation settings", () => {
		settings.runtime = "production";
		Object.assign(settings.environment, {
			BLENDCALC_RUNTIME_ENVIRONMENT: "production",
			BLENDCALC_ADVERTISING_MODE: "google",
		});
		expect(readAdvertisingConfiguration().mode).toBe("disabled");
		settings.environment.BLENDCALC_ADVERTISING_APPROVED = "true";
		expect(readAdvertisingConfiguration().mode).toBe("google");
	});
	it("permits network-free previews only in TEST", () => {
		settings.environment.BLENDCALC_ADVERTISING_MODE = "preview";
		expect(readAdvertisingConfiguration().mode).toBe("preview");
		settings.runtime = "production";
		expect(readAdvertisingConfiguration().mode).toBe("disabled");
	});
});
