import { normalizeBarcode } from "$lib/utils/barcode/barcode";
import type { FoodSafetyAlertCheck } from "$lib/utils/food/types";
import type { BarcodeProductDraft } from "./barcodeProductMappers";

export type BarcodeLookupResult =
	| {
			status: "found";
			draft: BarcodeProductDraft;
			safetyCheck?: FoodSafetyAlertCheck;
	  }
	| {
			status: "not-found";
			barcode: string;
			safetyCheck?: FoodSafetyAlertCheck;
	  }
	| {
			status: "error";
			barcode: string;
			message: string;
			safetyCheck?: FoodSafetyAlertCheck;
	  };

const pendingBarcodeLookups = new Map<string, Promise<BarcodeLookupResult>>();

const requestBarcodeProduct = async (
	canonicalBarcode: string,
): Promise<BarcodeLookupResult> => {
	try {
		const response = await fetch(
			`/api/products/barcode/${encodeURIComponent(canonicalBarcode)}`,
			{ headers: { accept: "application/json" } },
		);
		if (response.status === 404) {
			return {
				status: "not-found",
				barcode: canonicalBarcode,
				safetyCheck: { status: "unavailable", alerts: [] },
			};
		}
		if (!response.ok) throw new Error("Barcode lookup failed.");
		return (await response.json()) as BarcodeLookupResult;
	} catch {
		return {
			status: "error",
			barcode: canonicalBarcode,
			message:
				"Product lookup is temporarily unavailable. You can still enter the label manually.",
		};
	}
};

export const lookupBarcodeProduct = async (
	barcode: string,
): Promise<BarcodeLookupResult> => {
	const canonicalBarcode = normalizeBarcode(barcode);
	if (!canonicalBarcode) {
		return {
			status: "error",
			barcode,
			message: "This does not look like a valid UPC or EAN barcode.",
		};
	}

	const pendingLookup = pendingBarcodeLookups.get(canonicalBarcode);
	if (pendingLookup) return pendingLookup;

	const lookup = requestBarcodeProduct(canonicalBarcode);
	pendingBarcodeLookups.set(canonicalBarcode, lookup);
	try {
		return await lookup;
	} finally {
		if (pendingBarcodeLookups.get(canonicalBarcode) === lookup) {
			pendingBarcodeLookups.delete(canonicalBarcode);
		}
	}
};
