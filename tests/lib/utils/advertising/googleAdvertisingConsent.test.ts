import { describe, expect, it, vi } from "vitest";
import {
	hasGoogleAdvertisingConsent,
	observeGoogleAdvertisingConsent,
	reopenGooglePrivacyChoices,
	type GoogleAdvertisingWindow,
} from "$lib/utils/advertising/googleAdvertisingConsent";

const granted = {
	adStoragePurposeConsentStatus: 1,
	adUserDataPurposeConsentStatus: 1,
	adPersonalizationPurposeConsentStatus: 1,
};
const fixture = () => {
	const queue: Array<Record<string, () => void>> = [];
	let tcf = (_: unknown, __: boolean) => {};
	let gpp = (_: unknown, __: boolean) => {};
	const target: GoogleAdvertisingWindow = {
		googlefc: {
			callbackQueue: queue,
			getGoogleConsentModeValues: () => granted,
			usstatesoptout: { getInitialUsStatesOptOutStatus: () => 2 },
		},
		__tcfapi: vi.fn((command, _, cb) => {
			if (command === "addEventListener") {
				tcf = cb as typeof tcf;
				cb({ eventStatus: "tcloaded", listenerId: 3 }, true);
			}
		}),
		__gpp: vi.fn((command, cb) => {
			if (command === "addEventListener") {
				gpp = cb as typeof gpp;
				cb({ eventName: "listenerRegistered", listenerId: 7 }, true);
			}
		}),
	};
	const fire = (key: string) => {
		for (const entry of queue) entry[key]?.();
	};
	return {
		target,
		fire,
		tcf: () => tcf({}, true),
		gpp: () => gpp({ eventName: "sectionChange" }, true),
	};
};
describe("certified Google consent boundary", () => {
	it("requires both regional and purpose data rather than API readiness", () => {
		const f = fixture();
		const change = vi.fn();
		observeGoogleAdvertisingConsent(f.target, change);
		f.fire("CONSENT_API_READY");
		expect(change).toHaveBeenLastCalledWith(false);
		f.fire("CONSENT_MODE_DATA_READY");
		expect(change).toHaveBeenLastCalledWith(false);
		f.fire("INITIAL_US_STATES_OPT_OUT_DATA_READY");
		expect(change).toHaveBeenLastCalledWith(true);
	});
	it.each([0, 2, 4, undefined, 99])(
		"rejects unknown/denied/unconfigured purpose %s",
		(status) => {
			expect(
				hasGoogleAdvertisingConsent(
					{ ...granted, adStoragePurposeConsentStatus: status },
					2,
				),
			).toBe(false);
		},
	);
	it.each([0, 3, 99])("rejects unknown or opted-out US status %s", (status) => {
		expect(hasGoogleAdvertisingConsent(granted, status)).toBe(false);
	});
	it("accepts a provider-confirmed non-applicable purpose", () => {
		expect(
			hasGoogleAdvertisingConsent(
				{ ...granted, adPersonalizationPurposeConsentStatus: 3 },
				1,
			),
		).toBe(true);
	});
	it.each(["tcf", "gpp"] as const)(
		"stops on %s changes and never reuses initial status",
		(framework) => {
			const f = fixture();
			const change = vi.fn();
			observeGoogleAdvertisingConsent(f.target, change);
			f.fire("CONSENT_API_READY");
			f.fire("CONSENT_MODE_DATA_READY");
			f.fire("INITIAL_US_STATES_OPT_OUT_DATA_READY");
			f[framework]();
			expect(change).toHaveBeenLastCalledWith(false);
			f.fire("CONSENT_MODE_DATA_READY");
			expect(change).toHaveBeenLastCalledWith(false);
		},
	);
	it("fails closed if a revocation framework is absent", () => {
		const f = fixture();
		delete f.target.__gpp;
		const change = vi.fn();
		observeGoogleAdvertisingConsent(f.target, change);
		f.fire("CONSENT_API_READY");
		f.fire("CONSENT_MODE_DATA_READY");
		f.fire("INITIAL_US_STATES_OPT_OUT_DATA_READY");
		expect(change).toHaveBeenLastCalledWith(false);
	});
	it("ignores delayed callbacks after account teardown and removes listeners", () => {
		const f = fixture();
		const change = vi.fn();
		const stop = observeGoogleAdvertisingConsent(f.target, change);
		f.fire("CONSENT_API_READY");
		stop();
		change.mockClear();
		f.fire("CONSENT_MODE_DATA_READY");
		f.tcf();
		expect(change).not.toHaveBeenCalled();
		expect(f.target.__tcfapi).toHaveBeenCalledWith(
			"removeEventListener",
			0,
			expect.any(Function),
			3,
		);
		expect(f.target.__gpp).toHaveBeenCalledWith(
			"removeEventListener",
			expect.any(Function),
			7,
		);
	});
	it("queues revocation rather than invoking a not-yet-ready provider", () => {
		const f = fixture();
		f.target.googlefc!.showRevocationMessage = vi.fn();
		expect(reopenGooglePrivacyChoices(f.target, "european")).toBe(true);
		expect(f.target.googlefc!.showRevocationMessage).not.toHaveBeenCalled();
		f.fire("CONSENT_API_READY");
		expect(f.target.googlefc!.showRevocationMessage).toHaveBeenCalledOnce();
		expect(reopenGooglePrivacyChoices({}, "us")).toBe(false);
	});
});
