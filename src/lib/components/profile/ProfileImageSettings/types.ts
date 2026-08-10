export type ProfileImageSettingsProps = {
	currentAltText?: string | null;
	hasCurrentImage: boolean;
	policyItems: readonly string[];
	requireHumanFace: boolean;
	errorMessage?: string | null;
	successMessage?: string | null;
};
