import type {
	MarketingEmailPreference,
	MarketingEmailPreferenceValues,
} from "$lib/utils/email/marketingEmailPreferences";

export type ProfileEmailPreferencesProps = {
	preferences: MarketingEmailPreference[];
	submittedValues?: MarketingEmailPreferenceValues | null;
	errorMessage?: string | null;
	successMessage?: string | null;
	onSaveSuccess?: () => void;
};
