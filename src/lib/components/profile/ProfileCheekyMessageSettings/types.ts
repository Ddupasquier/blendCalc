export type ProfileCheekyMessageSettingsProps = {
	initiallyEnabled: boolean;
	errorMessage?: string | null;
	successMessage?: string | null;
	onSaveSuccess?: () => void;
};
