export type ProfileImageSettingsProps = {
	currentImageUrl?: string | null;
	currentAltText?: string | null;
	submittedAltText?: string | null;
	hasCurrentImage: boolean;
	moderationStatus?: string | null;
	policyItems: readonly string[];
	requireHumanFace: boolean;
	errorMessage?: string | null;
	successMessage?: string | null;
	onSaveSuccess?: () => void;
};
