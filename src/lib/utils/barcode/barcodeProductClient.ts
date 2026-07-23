import { normalizeBarcode } from "$lib/utils/barcode/barcode";
import type { BarcodeProductDraft } from "./barcodeProductMappers";

export type BarcodeLookupResult =
	| { status: "found"; draft: BarcodeProductDraft }
	| { status: "not-found"; barcode: string }
	| { status: "error"; barcode: string; message: string };

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

	try {
		const response = await fetch(
			`/api/products/barcode/${encodeURIComponent(canonicalBarcode)}`,
			{ headers: { accept: "application/json" } },
		);
		if (response.status === 404) {
			return { status: "not-found", barcode: canonicalBarcode };
		}
		if (!response.ok) throw new Error("Barcode lookup failed.");
		return await response.json() as BarcodeLookupResult;
	} catch {
		return {
			status: "error",
			barcode: canonicalBarcode,
			message:
				"Product lookup is temporarily unavailable. You can still enter the label manually.",
		};
	}
};
