import type { FoodCategoryPickerOption } from "$lib/utils/food/categories/categoryPicker";
import type { FoodSafetyAlert } from "$lib/utils/food/types";
import type {
	FoodCategoryPickerStatus,
	ManualEntryBarcodeSuggestion,
} from "../../formTypes";

export type IdentityStepProps = {
	name: string;
	brandOwner: string;
	category: string;
	categoryOptionId: string;
	barcode: string;
	categoryWarningMessage: string;
	categorySourceValues: string[];
	barcodeMessage: string;
	barcodeSafetyAlerts: FoodSafetyAlert[];
	barcodeValidationMessage: string;
	checkingBarcodeReference: boolean;
	barcodeSuggestion: ManualEntryBarcodeSuggestion;
	onNameChange: (value: string) => void;
	onBrandChange: (value: string) => void;
	onCategoryChange: (option: FoodCategoryPickerOption) => void;
	onCategoryStatusChange: (status: FoodCategoryPickerStatus) => void;
	onBarcodeChange: (value: string) => void;
	onBarcodeBlur: () => void | Promise<void>;
	onApplyBarcodeSuggestion: () => void | Promise<void>;
	onKeepManualBarcodeEntry: () => void;
	onReportBarcodeIssue: () => void;
	onNameInput?: (element: HTMLInputElement) => void;
	onNext: () => void | Promise<void>;
};
