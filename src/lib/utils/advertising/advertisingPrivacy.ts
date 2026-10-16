/** Browser-wide refusal only: this preference can never grant advertising consent. */
export const ADVERTISING_BLOCK_STORAGE_KEY = "blendcalc-advertising-block-v1";

export const readAdvertisingBlock = (
	stored: string | null,
	globalPrivacyControl = false,
): boolean =>
	globalPrivacyControl ||
	(stored !== null && stored !== "allow-consent-request");

export const writeAdvertisingBlock = (
	storage: Pick<Storage, "setItem">,
	blocked: boolean,
): boolean => {
	try {
		storage.setItem(
			ADVERTISING_BLOCK_STORAGE_KEY,
			blocked ? "blocked" : "allow-consent-request",
		);
		return true;
	} catch {
		return false;
	}
};

export type PrivacySignalNavigator = Navigator & {
	globalPrivacyControl?: boolean;
};
