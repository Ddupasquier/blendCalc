export type PrivilegedToolInformationKey =
	| "product-submissions"
	| "food-warning-reports"
	| "profile-images"
	| "account-access"
	| "catalog-data-health";

export type PrivilegedToolInformation = {
	title: string;
	purpose: string;
	reviewSteps: readonly string[];
	decisionEffect: string;
	guardrail: string;
};

export type PrivilegedToolInformationSheetProps = {
	open: boolean;
	action: PrivilegedToolInformationKey;
	onClose: () => void;
};
