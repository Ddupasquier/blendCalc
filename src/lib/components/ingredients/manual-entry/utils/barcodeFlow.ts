import type { ServingMeasureUnit } from "../../../../../defaults/servingMeasureDefaults";
import { normalizeBarcode } from "$lib/utils/barcode/barcode";
import {
	barcodeDraftHasEntryChanges,
	type BarcodeProductDraftComparisonEntry,
} from "$lib/utils/barcode/barcodeDraftComparison";
import {
	lookupBarcodeProduct,
	type BarcodeProductDraft,
	type BarcodeLookupResult,
} from "$lib/utils/barcode/productLookup";
import type { FdcFood, FdcNutrient } from "$lib/utils/food/types";

export type ManualEntryBarcodeDraftState = {
	name: string;
	brandOwner: string;
	category: string;
	servingLabel: string;
	servingWeightGrams: number;
	importedNutrients: FdcNutrient[];
	manualNutrientValues: Record<number, number>;
	useVolumeEquivalent: boolean;
	volumeQuantity: number | null;
	volumeUnit: ServingMeasureUnit;
	barcode: string;
	barcodeSource: FdcFood["barcodeSource"];
	reportedNutrientIds: number[];
	ingredients: string;
	ingredientList: string[];
	allergens: string[];
	traces: string[];
	dietaryTags: string[];
	labels: string[];
	categories: string[];
	checkedBarcodeReferenceKey: string;
};

export type ManualBarcodeReferencePlan =
	| {
			action: "clear";
	  }
	| {
			action: "invalid";
	  }
	| {
			action: "skip";
	  }
	| {
			action: "lookup";
			normalizedBarcode: string;
			referenceKey: string;
	  };

export type ManualBarcodeReferenceResult =
	| {
			status: "found";
			referenceKey: string;
			draft: BarcodeProductDraft;
			message: string;
	  }
	| {
			status: "not-found" | "error";
			referenceKey: string;
			message: string;
	  };

export const getBarcodeReferenceKey = (
	normalizedBarcode: string,
	_normalizedName: string,
) => normalizedBarcode;

export const getManualBarcodeReferencePlan = ({
	barcode,
	normalizedName,
	checkedBarcodeReferenceKey,
	checkingBarcodeReference,
}: {
	barcode: string;
	normalizedName: string;
	checkedBarcodeReferenceKey: string;
	checkingBarcodeReference: boolean;
}): ManualBarcodeReferencePlan => {
	const trimmedBarcode = barcode.trim();
	if (!trimmedBarcode) return { action: "clear" };

	const normalizedBarcode = normalizeBarcode(trimmedBarcode);
	if (!normalizedBarcode) return { action: "invalid" };

	const referenceKey = getBarcodeReferenceKey(normalizedBarcode, normalizedName);
	if (checkedBarcodeReferenceKey === referenceKey || checkingBarcodeReference) {
		return { action: "skip" };
	}

	return {
		action: "lookup",
		normalizedBarcode,
		referenceKey,
	};
};

export const lookupManualBarcodeReference = async ({
	normalizedBarcode,
	referenceKey,
	normalizedName,
}: {
	normalizedBarcode: string;
	referenceKey: string;
	normalizedName: string;
}): Promise<ManualBarcodeReferenceResult> => {
	const lookup = await lookupBarcodeProduct(normalizedBarcode);
	const result = getManualBarcodeReferenceResult({
		lookup,
		referenceKey,
		normalizedName,
	});
	return result;
};

export const getManualBarcodeReferenceResult = ({
	lookup,
	referenceKey,
	normalizedName,
}: {
	lookup: BarcodeLookupResult;
	referenceKey: string;
	normalizedName: string;
}): ManualBarcodeReferenceResult => {
	if (lookup.status === "found") {
		return {
			status: "found",
			referenceKey,
			draft: lookup.draft,
			message: getBarcodeFoundMessage(normalizedName, lookup.draft),
		};
	}

	return {
		status: lookup.status,
		referenceKey,
		message: getBarcodeLookupMessage(
			lookup.status,
			lookup.status === "error" ? lookup.message : undefined,
		),
	};
};

const normalizeName = (value: string) =>
	value
		.toLocaleLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim();

const isStringValue = (value: string | undefined): value is string =>
	Boolean(value);

export const namesLookDifferent = (enteredName: string, sourceName: string) => {
	const entered = normalizeName(enteredName);
	const source = normalizeName(sourceName);
	if (!entered || !source) return false;
	return !entered.includes(source) && !source.includes(entered);
};

export const getBarcodeFoundMessage = (
	enteredName: string,
	draft: BarcodeProductDraft,
) => {
	const mismatchCopy = namesLookDifferent(enteredName, draft.name)
		? ` Lookup found “${draft.name}”, so reviewers can compare it with your typed label if you share this product.`
		: " Reviewers can use this source reference if you share this product.";
	return `Barcode matched ${draft.sourceLabel}.${mismatchCopy} Autofill is available, but optional.`;
};

export const getBarcodeLookupMessage = (
	status: "not-found" | "error",
	message?: string,
) =>
	status === "not-found"
		? "No source match found for this barcode yet. You can still save it; shared submissions will rely on label photos."
		: (message ?? "Barcode lookup failed. Try again.");

export const getBarcodeDraftState = (
	draft: BarcodeProductDraft,
): ManualEntryBarcodeDraftState => ({
	name: draft.name,
	brandOwner: draft.brandOwner,
	category: draft.resolvedCategory ?? "",
	servingLabel: draft.servingLabel,
	servingWeightGrams: draft.servingWeightGrams,
	importedNutrients: [...draft.nutrients],
	manualNutrientValues: Object.fromEntries(
		draft.nutrients.map((nutrient) => [
			nutrient.nutrientId,
			Number.isFinite(nutrient.value) ? Math.max(0, nutrient.value) : 0,
		]),
	),
	useVolumeEquivalent: Boolean(draft.volumeEquivalent),
	volumeQuantity: draft.volumeEquivalent?.quantity ?? null,
	volumeUnit: draft.volumeEquivalent?.unit ?? "tbsp",
	barcode: draft.barcode,
	barcodeSource: draft.source === "shared-catalog" ? "community" : draft.source,
	reportedNutrientIds: [...draft.reportedNutrientIds],
	ingredients: draft.ingredients ?? "",
	ingredientList: [...(draft.ingredientList ?? [])],
	allergens: [...(draft.allergens ?? [])],
	traces: [...(draft.traces ?? [])],
	dietaryTags: [...(draft.dietaryTags ?? [])],
	labels: [...(draft.labels ?? [])],
	categories: [
		...new Set([
			draft.resolvedCategory,
			...(draft.categories ?? []),
		].filter(isStringValue)),
	],
	checkedBarcodeReferenceKey: getBarcodeReferenceKey(draft.barcode, draft.name),
});

export const getBarcodeCategoryWarningMessage = ({
	barcode,
	sourceDraft,
	selectedCategory,
}: {
	barcode: string;
	sourceDraft: BarcodeProductDraft | null;
	selectedCategory: string;
}) => {
	const normalizedBarcode = normalizeBarcode(barcode);
	if (
		!normalizedBarcode ||
		!sourceDraft ||
		sourceDraft.barcode !== normalizedBarcode ||
		selectedCategory.trim()
	) {
		return "";
	}

	if (sourceDraft.resolvedCategory || sourceDraft.categoryResolution) {
		return "";
	}

	return "Barcode found, but blendCalc does not have a trusted category for it yet. Please select a category for this ingredient.";
};

export const getBarcodeImportMessage = (
	draft: BarcodeProductDraft,
	optionalNutrientCount: number,
	mode: "autofill" | "scan",
) => {
	const nutrientSummary = optionalNutrientCount > 0
		? ` ${optionalNutrientCount} additional reported nutrients were included.`
		: " No additional vitamin or mineral values were reported by this source.";
	const volumeSummary = draft.volumeEquivalent
		? " The package's volume-to-weight serving was also included."
		: "";
	const prefix =
		mode === "autofill"
			? `Autofilled from ${draft.sourceLabel}.`
			: `Label data imported from ${draft.sourceLabel}.`;
	return `${prefix}${nutrientSummary}${volumeSummary} Review it before saving.`;
};

export const getKeepManualBarcodeMessage = (draft: BarcodeProductDraft) =>
	`Keeping your manually entered label. Reviewers will see that ${draft.sourceLabel} has source data for this barcode if you share this product.`;

export const getBarcodeReferenceReviewFlags = ({
	shareWithCatalog,
	barcode,
	sourceDraft,
	currentEntry,
	barcodeSource,
	barcodeReferenceAcceptedBarcode,
}: {
	shareWithCatalog: boolean;
	barcode: string;
	sourceDraft: BarcodeProductDraft | null;
	currentEntry: BarcodeProductDraftComparisonEntry;
	barcodeSource: FdcFood["barcodeSource"];
	barcodeReferenceAcceptedBarcode: string;
}) => {
	const normalizedBarcode = normalizeBarcode(barcode);
	if (
		!shareWithCatalog ||
		!normalizedBarcode ||
		!sourceDraft ||
		sourceDraft.barcode !== normalizedBarcode
	) {
		return [];
	}

	const hasChanges = barcodeDraftHasEntryChanges(sourceDraft, currentEntry);
	if (!hasChanges) return [];

	const sourceReference = sourceDraft.sourceReference
		? ` Reference: ${sourceDraft.sourceReference}.`
		: "";
	if (sourceDraft.source === "shared-catalog") {
		return [
			`User submitted changes for an existing blendCalc catalog product. Source product: “${sourceDraft.name}”.${sourceReference} Compare user-entered data against active source/API data before approval.`,
		];
	}

	if (
		barcodeSource !== "manual" &&
		barcodeReferenceAcceptedBarcode === normalizedBarcode
	) {
		return [];
	}

	return [
		`User chose to share manually entered product data instead of autofilling from ${sourceDraft.sourceLabel}. Source product: “${sourceDraft.name}”.${sourceReference} Compare user-entered data against active source/API data before approval.`,
	];
};
