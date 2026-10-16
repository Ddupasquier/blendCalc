import { getContext } from "svelte";
import {
	createAdUsage,
	recordCompletedAdAction,
	restoreAdUsage,
	type AdEligibility,
} from "./adPolicy";
import {
	ADVERTISING_PRIVACY_CHANGED_EVENT,
	type AdvertisingConfiguration,
} from "./advertisingConfiguration";
import {
	ADVERTISING_BLOCK_STORAGE_KEY,
	readAdvertisingBlock,
	type PrivacySignalNavigator,
} from "./advertisingPrivacy";
import {
	observeGoogleAdvertisingConsent,
	type GoogleAdvertisingWindow,
} from "./googleAdvertisingConsent";
import { loadGoogleAdvertising } from "./googleAdDelivery";
import { getScopedStorageKey } from "$lib/utils/storage/client/storageScope";
import { INGREDIENT_LISTS_CHANGED_EVENT } from "$lib/utils/storage/client/ingredientLists";
import { SAVED_RECIPES_CHANGED_EVENT } from "$lib/utils/storage/client/savedRecipes";

export const ADVERTISING_SESSION_CONTEXT = Symbol("advertising-session");
const USAGE_KEY = "blendcalc-advertising-usage-v1";

export const createAdvertisingSession = () => {
	const advertisingState = $state({
		mode: "disabled" as AdvertisingConfiguration["mode"],
		accountKey: "",
		eligibility: "unknown" as AdEligibility,
		tutorialOpen: true,
		blocked: true,
		consent: false,
		visible: false,
		editing: false,
		networkReady: false,
		surfaceAllowed: false,
		reviewingPrivacy: false,
		now: Date.now(),
		usage: createAdUsage(Date.now()),
	});
	let generation = 0;
	let stopConsent = () => {};
	let started = false;
	let initializedAccount = "";
	let privacyWriteFailed = false;
	const refreshPrivacy = () => {
		try {
			advertisingState.blocked =
				privacyWriteFailed ||
				readAdvertisingBlock(
					localStorage.getItem(ADVERTISING_BLOCK_STORAGE_KEY),
					(navigator as PrivacySignalNavigator).globalPrivacyControl === true,
				);
		} catch {
			advertisingState.blocked = true;
		}
	};
	const update = (
		configuration: AdvertisingConfiguration,
		accountKey: string,
		eligibility: AdEligibility,
		tutorialOpen: boolean,
	) => {
		if (
			advertisingState.accountKey !== accountKey ||
			advertisingState.mode !== configuration.mode
		) {
			generation += 1;
			stopConsent();
			stopConsent = () => {};
			started = false;
			initializedAccount = "";
			advertisingState.consent = false;
			advertisingState.networkReady = false;
			advertisingState.now = Date.now();
			advertisingState.usage = createAdUsage(advertisingState.now);
		}
		advertisingState.accountKey = accountKey;
		advertisingState.mode = configuration.mode;
		advertisingState.eligibility = eligibility;
		advertisingState.tutorialOpen = tutorialOpen;
		advertisingState.reviewingPrivacy = false;
	};
	const persistUsage = () => {
		try {
			localStorage.setItem(
				getScopedStorageKey(USAGE_KEY),
				JSON.stringify(advertisingState.usage),
			);
		} catch {
			privacyWriteFailed = true;
			advertisingState.blocked = true;
		}
	};
	const ensureNetwork = async () => {
		if (
			started ||
			advertisingState.mode !== "google" ||
			!advertisingState.surfaceAllowed ||
			advertisingState.eligibility !== "supported" ||
			advertisingState.blocked ||
			advertisingState.tutorialOpen
		)
			return;
		started = true;
		const ownGeneration = generation;
		try {
			const response = await fetch("/api/advertising/access", {
				cache: "no-store",
				signal: AbortSignal.timeout(5_000),
			});
			const access = response.ok ? await response.json() : null;
			if (ownGeneration !== generation) return;
			advertisingState.eligibility =
				access?.eligibility === "supported" || access?.eligibility === "ad-free"
					? access.eligibility
					: "unknown";
			if (
				advertisingState.eligibility !== "supported" ||
				advertisingState.blocked ||
				!advertisingState.surfaceAllowed
			)
				return;
		} catch {
			if (ownGeneration === generation)
				advertisingState.eligibility = "unknown";
			return;
		}
		const target = window as unknown as GoogleAdvertisingWindow;
		target.googlefc ??= { callbackQueue: [] };
		target.googlefc.usstatesoptout ??= {};
		target.googlefc.usstatesoptout.overrideDnsLink = true;
		target.googlefc.controlledMessagingFunction = (message) =>
			message.proceed(
				ownGeneration === generation &&
					(advertisingState.reviewingPrivacy ||
						(advertisingState.surfaceAllowed &&
							!advertisingState.blocked &&
							advertisingState.eligibility === "supported" &&
							!advertisingState.tutorialOpen)),
			);
		stopConsent = observeGoogleAdvertisingConsent(
			window as unknown as GoogleAdvertisingWindow,
			(allowed) => {
				if (ownGeneration === generation) advertisingState.consent = allowed;
			},
		);
		try {
			await loadGoogleAdvertising(document);
			if (ownGeneration === generation) advertisingState.networkReady = true;
		} catch {
			if (ownGeneration === generation) {
				advertisingState.networkReady = false;
				advertisingState.consent = false;
			}
		}
	};
	const mount = () => {
		let mounted = true;
		const visibility = () => {
			advertisingState.visible = document.visibilityState === "visible";
			refreshPrivacy();
		};
		const focus = () => {
			// Focus can change synchronously while Svelte removes a rendered control.
			// Update after that render and inspect the resulting focused element.
			queueMicrotask(() => {
				if (!mounted) return;
				advertisingState.editing = Boolean(
					document.activeElement?.matches(
						"input,textarea,select,[contenteditable='true']",
					),
				);
			});
		};
		const storage = (event: StorageEvent) => {
			if (event.key === null || event.key === ADVERTISING_BLOCK_STORAGE_KEY)
				refreshPrivacy();
		};
		const localPrivacy = (event: Event) => {
			const detail = (event as CustomEvent<{ persisted: boolean }>).detail;
			privacyWriteFailed = detail?.persisted === false;
			refreshPrivacy();
		};
		const completed = () => {
			if (!advertisingState.accountKey) return;
			advertisingState.now = Date.now();
			advertisingState.usage = recordCompletedAdAction(advertisingState.usage);
			persistUsage();
		};
		visibility();
		focus();
		window.addEventListener("storage", storage);
		window.addEventListener(ADVERTISING_PRIVACY_CHANGED_EVENT, localPrivacy);
		document.addEventListener("visibilitychange", visibility);
		document.addEventListener("focusin", focus);
		document.addEventListener("focusout", focus);
		window.addEventListener(INGREDIENT_LISTS_CHANGED_EVENT, completed);
		window.addEventListener(SAVED_RECIPES_CHANGED_EVENT, completed);
		return () => {
			mounted = false;
			generation += 1;
			stopConsent();
			window.removeEventListener("storage", storage);
			window.removeEventListener(
				ADVERTISING_PRIVACY_CHANGED_EVENT,
				localPrivacy,
			);
			document.removeEventListener("visibilitychange", visibility);
			document.removeEventListener("focusin", focus);
			document.removeEventListener("focusout", focus);
			window.removeEventListener(INGREDIENT_LISTS_CHANGED_EVENT, completed);
			window.removeEventListener(SAVED_RECIPES_CHANGED_EVENT, completed);
		};
	};
	const restoreUsage = () => {
		if (
			!advertisingState.accountKey ||
			initializedAccount === advertisingState.accountKey
		)
			return;
		initializedAccount = advertisingState.accountKey;
		try {
			advertisingState.usage = restoreAdUsage(
				localStorage.getItem(getScopedStorageKey(USAGE_KEY)),
				Date.now(),
			);
		} catch {
			advertisingState.usage = createAdUsage(Date.now());
		}
		refreshPrivacy();
	};
	return {
		state: advertisingState,
		update,
		mount,
		ensureNetwork,
		restoreUsage,
		persistUsage,
	};
};
export type AdvertisingSession = ReturnType<typeof createAdvertisingSession>;
export const getAdvertisingSession = () =>
	getContext<AdvertisingSession | undefined>(ADVERTISING_SESSION_CONTEXT);
