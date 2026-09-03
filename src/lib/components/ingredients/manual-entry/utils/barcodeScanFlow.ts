import type { BarcodeScanResult } from "$lib/utils/barcode/types";
import {
	lookupBarcodeProduct,
	type BarcodeProductDraft,
} from "$lib/utils/barcode/productLookup";
import type { FoodSafetyAlert } from "$lib/utils/food/types";
import { getBarcodeImportMessage } from "$lib/components/ingredients/manual-entry/utils/barcodeFlow";
import type { ManualEntryNutrientDefinition } from "$lib/utils/food/nutrients/nutrientDefinitions";

export type ManualEntryBarcodeScanOutcome =
	| {
			status: "found";
			draft: BarcodeProductDraft;
			message: string;
			focusTarget: "destination";
			safetyAlerts: FoodSafetyAlert[];
	  }
	| {
			status: "not-found" | "error";
			message: string;
			focusTarget: "name";
			safetyAlerts: FoodSafetyAlert[];
	  };

export const resolveManualEntryBarcodeScan = async ({
	result,
	manualEntryNutrientFields,
}: {
	result: BarcodeScanResult;
	manualEntryNutrientFields: ManualEntryNutrientDefinition[];
}): Promise<ManualEntryBarcodeScanOutcome> => {
	const lookup = await lookupBarcodeProduct(result.canonicalValue);

	if (lookup.status === "found") {
		return {
			status: "found",
			draft: lookup.draft,
			message: getBarcodeImportMessage(
				lookup.draft,
				manualEntryNutrientFields,
				"scan",
			),
			focusTarget: "destination",
			safetyAlerts: lookup.safetyCheck?.alerts ?? [],
		};
	}

	return {
		status: lookup.status,
		message:
			lookup.status === "not-found"
				? "No matching product was found. The barcode is filled in so you can enter the label manually."
				: lookup.message,
		focusTarget: "name",
		safetyAlerts: lookup.safetyCheck?.alerts ?? [],
	};
};
