import {
	formatFoodMetadataKey,
	formatFoodMetadataTag,
	getUniqueFoodMetadataTags,
} from "$lib/utils/food/records/foodMetadataPresentation";
import type {
	FoodItem,
	FoodBarcodeProvenance,
	FoodIdentityType,
	FoodProvenanceField,
	FoodSourceAttribution,
	FoodServing,
} from "$lib/utils/food/types";
import {
	formatServingGramWeightMethod,
	formatServingOrigin,
} from "$lib/utils/food/servings/servingDisplay";
import { resolveFoodIdentityType } from "$lib/utils/food/identity/foodIdentity";

export type ProductInformationRow = {
	label: string;
	value: string;
};

export type ProductInformation = {
	productRows: ProductInformationRow[];
	servingRows: ProductInformationRow[];
	sourceRows: ProductInformationRow[];
	fieldSourceRows: ProductInformationRow[];
	sourceAttributions: FoodSourceAttribution[];
};

const numberFormatter = new Intl.NumberFormat("en-US", {
	maximumFractionDigits: 3,
});
const dateFormatter = new Intl.DateTimeFormat("en-US", {
	year: "numeric",
	month: "short",
	day: "numeric",
	timeZone: "UTC",
});

const cleanText = (value: string | null | undefined) => value?.trim() ?? "";
const formatNumber = (value: number) => numberFormatter.format(value);
const formatDateTime = (value: number | string | null | undefined) => {
	if (value === null || value === undefined || value === "") return "";
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? "" : dateFormatter.format(date);
};
const formatDate = (value: string | null | undefined) => {
	return formatDateTime(value);
};
const formatIdentityType = (value: FoodIdentityType | undefined) => {
	switch (value) {
		case "generic":
			return "Generic food";
		case "packaged":
			return "Packaged product";
		case "private-custom":
			return "Personal ingredient";
		case "unknown":
			return "Not confirmed";
		default:
			return "";
	}
};
const presentRows = (rows: ProductInformationRow[]) =>
	rows.filter((row) => row.value);
const formatBarcodeCaptureMethod = (
	value: FoodBarcodeProvenance["captureMethod"],
) => {
	switch (value) {
		case "linear-scan":
			return "Barcode scan";
		case "gs1-digital-link":
			return "GS1 Digital Link";
		case "manual-entry":
			return "Manual entry";
	}
};

const formatPackageQuantity = (food: FoodItem) => {
	const label = cleanText(food.packageQuantity?.label);
	if (label) return label;
	const amount = food.packageQuantity?.amount;
	const unit = cleanText(food.packageQuantity?.unit);
	return Number.isFinite(amount) && amount !== undefined
		? `${formatNumber(amount)}${unit ? ` ${unit}` : ""}`
		: "";
};

const formatServing = (serving: FoodServing) => {
	const label = cleanText(serving.label);
	const grams = `${formatNumber(serving.gramWeight)}g`;
	return label &&
		!label.toLocaleLowerCase("en-US").includes(grams.toLocaleLowerCase("en-US"))
		? `${label} · ${grams}`
		: label || grams;
};

const formatDensity = (food: FoodItem) => {
	const density = food.customDensityGramsPerMilliliter;
	if (!Number.isFinite(density) || density === undefined) return "";
	const confidence = food.customDensityConfidence
		? formatFoodMetadataTag(food.customDensityConfidence)
		: "";
	const variance =
		Number.isFinite(food.customDensityVariancePercent) &&
		food.customDensityVariancePercent !== undefined
			? ` ± ${formatNumber(food.customDensityVariancePercent)}%`
			: "";
	return `${formatNumber(density)} g/mL${variance}${confidence ? ` · ${confidence}` : ""}`;
};

const getProductRows = (food: FoodItem) => {
	const barcode = cleanText(food.barcode) || cleanText(food.gtinUpc);
	const categories = getUniqueFoodMetadataTags([
		food.foodCategory,
		food.brandedFoodCategory,
		...(food.categories ?? []),
	]);
	const labels = getUniqueFoodMetadataTags([
		...(food.labels ?? []),
		...(food.dietaryTags ?? []),
	]);

	return presentRows([
		{ label: "Brand", value: cleanText(food.brandOwner) },
		{ label: "Barcode / GTIN", value: barcode },
		{
			label: "Barcode format",
			value: cleanText(food.barcodeProvenance?.format),
		},
		{
			label: "Barcode captured by",
			value: food.barcodeProvenance
				? formatBarcodeCaptureMethod(food.barcodeProvenance.captureMethod)
				: "",
		},
		{ label: "Category", value: categories.join(", ") },
		{ label: "Package size", value: formatPackageQuantity(food) },
		{
			label: "Food type",
			value: formatIdentityType(resolveFoodIdentityType(food)),
		},
		{ label: "Scientific name", value: cleanText(food.scientificName) },
		{ label: "Also known as", value: cleanText(food.alternateDescription) },
		{ label: "Preparation", value: cleanText(food.preparation) },
		{ label: "Labels", value: labels.join(", ") },
		{ label: "Added to list", value: formatDateTime(food.listAddedAt) },
	]);
};

const getServingRows = (food: FoodItem) => {
	const normalizedServings = [...(food.foodServings ?? [])]
		.filter(
			(serving) =>
				Number.isFinite(serving.gramWeight) && serving.gramWeight > 0,
		)
		.sort(
			(left, right) =>
				Number(right.isPrimary) - Number(left.isPrimary),
		)
		.flatMap((serving, index) => {
			const prefix = serving.isPrimary
				? "Primary serving"
				: `Serving option ${index + 1}`;
			const sourceMeasure = [
				cleanText(serving.measureType),
				cleanText(serving.sourceMeasureKey),
			].filter(Boolean).join(" · ");
			return [
				{ label: prefix, value: formatServing(serving) },
				{ label: `${prefix} origin`, value: formatServingOrigin(serving) },
				{
					label: `${prefix} weight basis`,
					value: [
						formatServingGramWeightMethod(serving),
						cleanText(serving.calculationBasis),
					].filter(Boolean).join(" · "),
				},
				{ label: `${prefix} source measure`, value: sourceMeasure },
			];
		});
	const sourceServing =
		normalizedServings.length === 0 &&
		Number.isFinite(food.servingSize) &&
		food.servingSize !== undefined
			? `${formatNumber(food.servingSize)}${food.servingSizeUnit ? ` ${food.servingSizeUnit}` : ""}`
			: "";
	const personalServing =
		normalizedServings.length === 0 &&
		Number.isFinite(food.customServingWeightGrams) &&
		food.customServingWeightGrams !== undefined
			? `${cleanText(food.customServingLabel) || "Serving"} · ${formatNumber(food.customServingWeightGrams)}g`
			: "";

	return presentRows([
		...normalizedServings,
		{ label: "Source serving", value: sourceServing },
		{ label: "Personal serving", value: personalServing },
		{
			label: "Household measure",
			value: cleanText(food.householdServingFullText),
		},
		{ label: "Weight-to-volume density", value: formatDensity(food) },
		{ label: "Density note", value: cleanText(food.customDensityLabel) },
	]);
};

const getSourceRows = (food: FoodItem) => {
	const identifiers = food.sourceIdentifiers ?? {};
	const attribution = food.sourceAttribution ?? food.sourceAttributions?.[0];
	const barcode = cleanText(food.barcode) || cleanText(food.gtinUpc);
	const identifierRows = Object.entries(identifiers)
		.filter(([, value]) => {
			const identifier = cleanText(value);
			return identifier && identifier !== barcode;
		})
		.map(([key, value]) => ({
			label: formatFoodMetadataKey(key),
			value: cleanText(value),
		}));

	return presentRows([
		{ label: "Source organization", value: cleanText(attribution?.sourceName) },
		{ label: "Dataset", value: cleanText(attribution?.datasetName) },
		{ label: "Dataset version", value: cleanText(attribution?.datasetVersion) },
		...identifierRows,
		{
			label: "Published",
			value: formatDate(
				food.sourcePublishedDate ??
					food.sourceMetadata?.publishedAt ??
					food.publicationDate ??
					food.publishedDate,
			),
		},
		{
			label: "Available since",
			value: formatDate(
				food.sourceMetadata?.availableAt ?? food.availableDate,
			),
		},
		{
			label: "Last updated",
			value: formatDate(
				food.sourceModifiedDate ??
					food.sourceMetadata?.updatedAt ??
					food.sourceMetadata?.modifiedAt ??
				food.modifiedDate,
			),
		},
		{
			label: "Source record created",
			value: formatDate(food.sourceMetadata?.createdAt),
		},
		{
			label: "Discontinued",
			value: formatDate(
				food.sourceMetadata?.discontinuedAt ?? food.discontinuedDate,
			),
		},
		{
			label: "Source revision",
			value:
				food.sourceMetadata?.revision === undefined
					? ""
					: String(food.sourceMetadata.revision),
		},
		{
			label: "Record languages",
			value: getUniqueFoodMetadataTags([
				food.sourceMetadata?.language,
				...(food.sourceMetadata?.languages ?? []),
			]).join(", "),
		},
		{
			label: "Markets",
			value: getUniqueFoodMetadataTags(
				food.sourceMetadata?.marketCountries ?? [],
			).join(", "),
		},
		{
			label: "Record status",
			value: food.sourceMetadata?.obsolete ? "Obsolete" : "",
		},
		{
			label: "Obsolete since",
			value: formatDate(food.sourceMetadata?.obsoleteSince),
		},
	]);
};

const FIELD_LABELS: Record<FoodProvenanceField, string> = {
	productName: "Product name",
	brandOwner: "Brand",
	nutrition: "Nutrition data",
	image: "Product image",
	categories: "Categories",
	serving: "Serving data",
	ingredients: "Ingredient statement",
	allergens: "Contains disclosure",
	traces: "May contain disclosure",
	precautionaryStatements: "Package precautionary statements",
	dietaryTags: "Dietary tags",
	labels: "Product labels",
	structuredIngredients: "Ingredient breakdown",
	ingredientAnalysis: "Ingredient analysis",
	additives: "Additives",
	package: "Package details",
	scientificName: "Scientific name",
	alternateDescription: "Alternate description",
	preparation: "Preparation",
	sourceMetadata: "Source record details",
};

const formatFieldSource = (
	source: NonNullable<FoodItem["fieldProvenance"]>[FoodProvenanceField],
) => {
	if (!source?.source?.trim()) return "";
	const sourceLabel = formatFoodMetadataKey(source.source);
	const sourceReference = cleanText(source.sourceReference);
	return sourceReference
		? `${sourceLabel} · ${sourceReference}`
		: sourceLabel;
};

const getFieldSourceRows = (food: FoodItem) =>
	(Object.entries(food.fieldProvenance ?? {}) as Array<
		[
			FoodProvenanceField,
			NonNullable<FoodItem["fieldProvenance"]>[FoodProvenanceField],
		]
	>)
		.filter(([, source]) => Boolean(source))
		.map(([field, source]) => ({
			label: FIELD_LABELS[field],
			value: formatFieldSource(source),
		}))
		.filter((row) => Boolean(row.label && row.value));

export const getProductInformation = (food: FoodItem): ProductInformation => ({
	productRows: getProductRows(food),
	servingRows: getServingRows(food),
	sourceRows: getSourceRows(food),
	fieldSourceRows: getFieldSourceRows(food),
	sourceAttributions: [
		...new Map(
			[
				...(food.sourceAttributions ?? []),
				...(food.sourceAttribution ? [food.sourceAttribution] : []),
			].map((attribution) => [
				`${attribution.datasetKey}:${attribution.datasetVersion}:${attribution.sourceUrl}`,
				attribution,
			]),
		).values(),
	].sort((left, right) =>
		`${left.datasetName}:${left.datasetVersion}:${left.sourceUrl}`.localeCompare(
			`${right.datasetName}:${right.datasetVersion}:${right.sourceUrl}`,
		)
	),
});
