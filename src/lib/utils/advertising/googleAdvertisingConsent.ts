/** Google's certified CMP remains the consent owner. No consent strings are stored here. */
export type GoogleConsentValues = {
	adStoragePurposeConsentStatus?: number;
	adUserDataPurposeConsentStatus?: number;
	adPersonalizationPurposeConsentStatus?: number;
};
type FrameworkCallback = (
	data: { eventName?: string; eventStatus?: string; listenerId?: number },
	success: boolean,
) => void;
export type GoogleAdvertisingWindow = {
	googlefc?: {
		callbackQueue: Array<Record<string, () => void>>;
		getGoogleConsentModeValues?: () => GoogleConsentValues;
		showRevocationMessage?: () => void;
		controlledMessagingFunction?: (message: {
			proceed: (allowed: boolean) => void;
		}) => void;
		usstatesoptout?: {
			overrideDnsLink?: boolean;
			getInitialUsStatesOptOutStatus?: () => number;
			openConfirmationDialog?: (callback: (optedOut: boolean) => void) => void;
		};
	};
	__tcfapi?: (
		command: string,
		version: number,
		callback: FrameworkCallback,
		parameter?: number,
	) => void;
	__gpp?: (
		command: string,
		callback: FrameworkCallback,
		parameter?: number,
	) => void;
};
export const hasGoogleAdvertisingConsent = (
	values: GoogleConsentValues | undefined,
	usStatus: number,
): boolean =>
	Boolean(values) &&
	[1, 2].includes(usStatus) &&
	[
		values?.adStoragePurposeConsentStatus,
		values?.adUserDataPurposeConsentStatus,
		values?.adPersonalizationPurposeConsentStatus,
	].every((value) => value === 1 || value === 3);

/** After a framework change, pause for the rest of this document. Never reuse an initial US status. */
export const observeGoogleAdvertisingConsent = (
	target: GoogleAdvertisingWindow,
	onChange: (allowed: boolean) => void,
) => {
	let active = true;
	let invalidated = false;
	let modeReady = false;
	let usReady = false;
	let tcfListener: number | undefined;
	let gppListener: number | undefined;
	let tcfObserved = false;
	let gppObserved = false;
	const fc = (target.googlefc ??= { callbackQueue: [] });
	fc.callbackQueue ??= [];
	const deny = () => {
		invalidated = true;
		if (active) onChange(false);
	};
	const publish = () => {
		if (!active) return;
		try {
			onChange(
				!invalidated &&
					tcfObserved &&
					gppObserved &&
					modeReady &&
					usReady &&
					hasGoogleAdvertisingConsent(
						fc.getGoogleConsentModeValues?.(),
						fc.usstatesoptout?.getInitialUsStatesOptOutStatus?.() ?? 0,
					),
			);
		} catch {
			deny();
		}
	};
	onChange(false);
	fc.callbackQueue.push({
		CONSENT_API_READY: () => {
			if (!active) return;
			try {
				if (!target.__tcfapi || !target.__gpp) {
					deny();
					return;
				}
				target.__tcfapi?.("addEventListener", 0, (data, success) => {
					if (!active) return;
					tcfListener = data?.listenerId ?? tcfListener;
					if (!success || (tcfObserved && modeReady && usReady)) deny();
					tcfObserved = true;
					publish();
				});
				target.__gpp?.("addEventListener", (data, success) => {
					if (!active) return;
					gppListener = data?.listenerId ?? gppListener;
					if (
						!success ||
						(gppObserved &&
							modeReady &&
							usReady &&
							data?.eventName !== "listenerRegistered")
					)
						deny();
					gppObserved = true;
					publish();
				});
			} catch {
				deny();
			}
		},
	});
	fc.callbackQueue.push({
		CONSENT_MODE_DATA_READY: () => {
			modeReady = true;
			publish();
		},
	});
	fc.callbackQueue.push({
		INITIAL_US_STATES_OPT_OUT_DATA_READY: () => {
			usReady = true;
			publish();
		},
	});
	return () => {
		active = false;
		try {
			if (tcfListener !== undefined)
				target.__tcfapi?.("removeEventListener", 0, () => {}, tcfListener);
			if (gppListener !== undefined)
				target.__gpp?.("removeEventListener", () => {}, gppListener);
		} catch {
			/* A failed provider cleanup must not affect app navigation. */
		}
	};
};

export const reopenGooglePrivacyChoices = (
	target: GoogleAdvertisingWindow,
	kind: "european" | "us",
) => {
	const fc = target.googlefc;
	if (!fc) return false;
	const method =
		kind === "european"
			? fc.showRevocationMessage
			: fc.usstatesoptout?.openConfirmationDialog;
	if (!method) return false;
	fc.callbackQueue.push({
		CONSENT_API_READY: () => {
			if (kind === "european") fc.showRevocationMessage?.();
			else fc.usstatesoptout?.openConfirmationDialog?.(() => {});
		},
	});
	return true;
};
