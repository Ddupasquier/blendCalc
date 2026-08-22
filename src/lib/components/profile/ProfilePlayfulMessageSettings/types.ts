export type ProfilePlayfulMessageSettingsProps = {
	initiallyEnabled: boolean;
	errorMessage?: string | null;
	successMessage?: string | null;
	onSaveSuccess?: () => void;
};
