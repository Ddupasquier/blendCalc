import {
	getDefaultServingMeasureUnit,
	type ServingMeasureUnit,
} from "$lib/utils/serving/servingMeasureCatalog";
import { normalizeBarcode } from "$lib/utils/barcode/barcode";
import {
	barcodeDraftHasEntryChanges,
	type BarcodeProductDraftComparisonEntry,
} from "$lib/utils/barcode/barcodeDraftComparison";
import {
	lookupBarcodeProduct,
	getBarcodeProductSourceDisplayLabel,
	type BarcodeProductDraft,
	type BarcodeLookupResult,
} from "$lib/utils/barcode/productLookup";
import type {
	FoodItem,
	FoodNutrient,
	FoodNutrientSourceReview,
	FoodFieldProvenance,
	FoodImageAsset,
	FoodIdentityType,
	FoodIngredientAnalysis,
	FoodPackageQuantity,
	FoodSourceRecordMetadata,
	FoodStructuredIngredient,
	FoodServing,
	FoodAlcoholByVolume,
	FoodRegulatoryDisclosure,
	FoodSafetyAlert,
} from "$lib/utils/food/types";
import { toFiniteNonnegativeNumber } from "$lib/utils/numbers/finiteNumbers";
import { getStoredImagePlacement } from "$lib/utils/food/images/imagePlacement";
import type { ImagePlacementValue } from "$lib/utils/food/images/types";
import type { ManualEntryNutrientDefinition } from "$lib/utils/food/nutrients/nutrientDefinitions";

export type ManualEntryBarcodeDraftState = {
	name: string;
	nameProvenance: NonNullable<FoodItem["nameProvenance"]>;
	brandOwner: string;
	category: string;
	categoryOptionId: string;
	categorySymbolKey: string;
	servingLabel: string;
	servingWeightGrams: number | null;
	usesInternal100GramBasis: boolean;
	serving?: FoodServing;
	importedNutrients: FoodNutrient[];
	nutrientSourceReview: FoodNutrientSourceReview[];
	manualNutrientValues: Record<number, number>;
	useServingMeasure: boolean;
	servingMeasureQuantity: number | null;
	servingMeasureUnit: ServingMeasureUnit;
	barcode: string;
	barcodeSource: FoodItem["barcodeSource"];
	reportedNutrientIds: number[];
	foodIdentityType: FoodIdentityType;
	ingredients: string;
	ingredientList: string[];
	structuredIngredients: FoodStructuredIngredient[];
	ingredientAnalysis?: FoodIngredientAnalysis;
	additives: string[];
	allergens: string[];
	traces: string[];
	dietaryTags: string[];
	labels: string[];
	packageQuantity?: FoodPackageQuantity;
	alcoholByVolume?: FoodAlcoholByVolume;
	regulatoryDisclosure?: FoodRegulatoryDisclosure;
	sourceMetadata?: FoodSourceRecordMetadata;
	categories: string[];
	image?: FoodImageAsset;
	imagePlacement: ImagePlacementValue;
	fieldProvenance?: FoodFieldProvenance;
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
			safetyAlerts: FoodSafetyAlert[];
	  }
	| {
			status: "not-found" | "error";
			referenceKey: string;
			message: string;
			safetyAlerts: FoodSafetyAlert[];
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

	const referenceKey = getBarcodeReferenceKey(
		normalizedBarcode,
		normalizedName,
	);
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
			safetyAlerts: lookup.safetyCheck?.alerts ?? [],
		};
	}

	return {
		status: lookup.status,
		referenceKey,
		message: getBarcodeLookupMessage(
			lookup.status,
			lookup.status === "error" ? lookup.message : undefined,
		),
		safetyAlerts: lookup.safetyCheck?.alerts ?? [],
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
	return `Barcode matched ${getBarcodeProductSourceDisplayLabel(draft)}.${mismatchCopy} Autofill is available, but optional.`;
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
): ManualEntryBarcodeDraftState => {
	const validNutrients = draft.nutrients.flatMap((nutrient) => {
		const value = toFiniteNonnegativeNumber(nutrient.value);
		return value === null ? [] : [{ ...nutrient, value }];
	});

	const usesInternal100GramBasis = draft.hasSourceServing === false;

	return {
		name: draft.name,
		nameProvenance: draft.nameProvenance,
		brandOwner: draft.brandOwner,
		category: draft.resolvedCategory ?? "",
		categoryOptionId: draft.categoryResolution?.categoryOptionId ?? "",
		categorySymbolKey: draft.categoryResolution?.symbolKey ?? "generic",
		servingLabel: usesInternal100GramBasis ? "" : draft.servingLabel,
		servingWeightGrams:
			Number.isFinite(draft.servingWeightGrams) &&
			Number(draft.servingWeightGrams) > 0
				? Number(draft.servingWeightGrams)
				: null,
		usesInternal100GramBasis,
		serving: usesInternal100GramBasis ? undefined : draft.serving,
		importedNutrients: validNutrients,
		nutrientSourceReview: [...(draft.nutrientSourceReview ?? [])],
		manualNutrientValues: Object.fromEntries(
			validNutrients.map((nutrient) => [nutrient.nutrientId, nutrient.value]),
		),
		useServingMeasure: Boolean(draft.serving?.amount && draft.serving?.unitKey),
		servingMeasureQuantity: draft.serving?.amount ?? null,
		servingMeasureUnit:
			draft.serving?.unitKey ?? getDefaultServingMeasureUnit("volume") ?? "",
		barcode: draft.barcode,
		barcodeSource:
			draft.source === "shared-catalog" ? "community" : draft.source,
		reportedNutrientIds: [...draft.reportedNutrientIds],
		foodIdentityType: draft.foodIdentityType ?? "packaged",
		ingredients: draft.ingredients ?? "",
		ingredientList: [...(draft.ingredientList ?? [])],
		structuredIngredients: [...(draft.structuredIngredients ?? [])],
		ingredientAnalysis: draft.ingredientAnalysis
			? { ...draft.ingredientAnalysis }
			: undefined,
		additives: [...(draft.additives ?? [])],
		allergens: [...(draft.allergens ?? [])],
		traces: [...(draft.traces ?? [])],
		dietaryTags: [...(draft.dietaryTags ?? [])],
		labels: [...(draft.labels ?? [])],
		packageQuantity: draft.packageQuantity
			? { ...draft.packageQuantity }
			: undefined,
		alcoholByVolume: draft.alcoholByVolume
			? { ...draft.alcoholByVolume }
			: undefined,
		regulatoryDisclosure: draft.regulatoryDisclosure
			? { ...draft.regulatoryDisclosure }
			: undefined,
		sourceMetadata: draft.sourceMetadata
			? { ...draft.sourceMetadata }
			: undefined,
		categories: [
			...new Set(
				[draft.resolvedCategory, ...(draft.categories ?? [])].filter(
					isStringValue,
				),
			),
		],
		image: draft.image,
		imagePlacement: getStoredImagePlacement(draft.image),
		fieldProvenance: draft.fieldProvenance
			? { ...draft.fieldProvenance }
			: undefined,
		checkedBarcodeReferenceKey: getBarcodeReferenceKey(
			draft.barcode,
			draft.name,
		),
	};
};

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
	manualEntryNutrientFields: ManualEntryNutrientDefinition[],
	mode: "autofill" | "scan",
) => {
	const acceptedNutrientIds = new Set(
		draft.nutrients.flatMap((nutrient) => {
			const nutrientId = Number(nutrient.nutrientId);
			return Number.isSafeInteger(nutrientId) &&
				nutrientId > 0 &&
				toFiniteNonnegativeNumber(nutrient.value) !== null
				? [nutrientId]
				: [];
		}),
	);
	const fieldStepByNutrientId = new Map(
		manualEntryNutrientFields.map((field) => [field.nutrientId, field.step]),
	);
	let macrosCount = 0;
	let extendedCount = 0;
	let unavailableFieldCount = 0;
	for (const nutrientId of acceptedNutrientIds) {
		const step = fieldStepByNutrientId.get(nutrientId);
		if (step === "macros") macrosCount += 1;
		else if (step === "extended") extendedCount += 1;
		else unavailableFieldCount += 1;
	}
	const acceptedNutrientCount = acceptedNutrientIds.size;
	const reviewLocations = [
		macrosCount > 0 ? `${macrosCount} in Macros` : "",
		extendedCount > 0 ? `${extendedCount} in Extended` : "",
	].filter(Boolean);
	const reviewSummary = reviewLocations.length
		? ` Review ${reviewLocations.join(" and ")}.`
		: "";
	const unavailableSummary =
		unavailableFieldCount > 0
			? ` ${unavailableFieldCount} accepted and retained ${unavailableFieldCount === 1 ? "value does" : "values do"} not yet have an editable Manual Entry field.`
			: "";
	const sourceReviewCount = draft.nutrientSourceReview?.length ?? 0;
	const sourceReviewSummary =
		sourceReviewCount > 0
			? ` ${sourceReviewCount} additional source ${sourceReviewCount === 1 ? "value needs" : "values need"} mapping review and ${sourceReviewCount === 1 ? "is" : "are"} not used in nutrition calculations.`
			: "";
	const nutrientSummary =
		acceptedNutrientCount === 0
			? ` No nutrition values from this source could be accepted and retained.${sourceReviewSummary} Missing values remain unknown.`
			: ` ${acceptedNutrientCount} nutrition ${acceptedNutrientCount === 1 ? "value was" : "values were"} accepted and retained from the source.${reviewSummary}${unavailableSummary}${sourceReviewSummary} Missing values remain unknown.`;
	const volumeSummary = draft.volumeEquivalent
		? " The package's volume-to-weight serving was also included."
		: draft.hasSourceServing === false
			? " No package serving weight was reported."
			: "";
	const prefix =
		mode === "autofill"
			? `Autofilled from ${getBarcodeProductSourceDisplayLabel(draft)}.`
			: `Label data imported from ${getBarcodeProductSourceDisplayLabel(draft)}.`;
	return `${prefix}${nutrientSummary}${volumeSummary} Review it before saving.`;
};

export const getKeepManualBarcodeMessage = (draft: BarcodeProductDraft) =>
	`Keeping your manually entered label. Reviewers will see that ${getBarcodeProductSourceDisplayLabel(draft)} has source data for this barcode if you share this product.`;

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
	barcodeSource: FoodItem["barcodeSource"];
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
		`User chose to share manually entered product data instead of autofilling from ${getBarcodeProductSourceDisplayLabel(sourceDraft)}. Source product: “${sourceDraft.name}”.${sourceReference} Compare user-entered data against active source/API data before approval.`,
	];
};
