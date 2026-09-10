export type PrivilegedToolInformationKey =
	| "product-submissions"
	| "food-warning-reports"
	| "profile-images"
	| "account-access"
	| "catalog-review-work"
	| "data-operations";

export type PrivilegedToolInformation = {
	title: string;
	purpose: string;
	whenToUse: string;
	reviewSteps: readonly string[];
	completion: string;
	decisionEffects: readonly string[];
	guardrail: string;
};

export type PrivilegedToolInformationSheetProps = {
	open: boolean;
	action: PrivilegedToolInformationKey;
	onClose: () => void;
};
