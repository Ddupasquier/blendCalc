import type { BarcodeScanResult } from "$lib/utils/barcode/types";
import {
	lookupBarcodeProduct,
	type BarcodeProductDraft,
} from "$lib/utils/barcode/productLookup";
import { getBarcodeImportMessage } from "$lib/components/ingredients/manual-entry/utils/barcodeFlow";

export type ManualEntryBarcodeScanOutcome =
	| {
			status: "found";
			draft: BarcodeProductDraft;
			message: string;
			focusTarget: "destination";
	  }
	| {
			status: "not-found" | "error";
			message: string;
			focusTarget: "name";
	  };

export const resolveManualEntryBarcodeScan = async ({
	result,
	getOptionalNutrientCount,
}: {
	result: BarcodeScanResult;
	getOptionalNutrientCount: () => number;
}): Promise<ManualEntryBarcodeScanOutcome> => {
	const lookup = await lookupBarcodeProduct(result.value);

	if (lookup.status === "found") {
		return {
			status: "found",
			draft: lookup.draft,
			message: getBarcodeImportMessage(
				lookup.draft,
				getOptionalNutrientCount(),
				"scan",
			),
			focusTarget: "destination",
		};
	}

	return {
		status: lookup.status,
		message:
			lookup.status === "not-found"
				? "No matching product was found. The barcode is filled in so you can enter the label manually."
				: lookup.message,
		focusTarget: "name",
	};
};
