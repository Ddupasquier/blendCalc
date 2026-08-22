export type ModeratorActionInformationKey =
	| "product-submissions"
	| "food-warning-reports"
	| "profile-images"
	| "account-access"
	| "catalog-data-health";

export type ModeratorActionInformation = {
	title: string;
	purpose: string;
	reviewSteps: readonly string[];
	decisionEffect: string;
	guardrail: string;
};

export type ModeratorActionInformationSheetProps = {
	open: boolean;
	action: ModeratorActionInformationKey;
	onClose: () => void;
};
