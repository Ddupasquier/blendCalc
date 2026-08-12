import {
	BLENDCALC_API_V1,
	type ApiV1Category,
	type ApiV1CompatibilityEvaluation,
	type ApiV1FieldSource,
	type ApiV1Image,
	type ApiV1Pagination,
	type ApiV1Product,
	type ApiV1ProductRevisionChange,
	type ApiV1ProductRevisionHistoryItem,
	type ApiV1Source,
	type ApiV1SourceAttribution,
	type ApiV1Warning,
} from "$lib/api/v1/types";
import {
	getApprovedCatalogRecordByBarcode,
	searchApprovedCatalogRecordsPage,
	type ApprovedCatalogRecord,
} from "$lib/server/products/catalogRead.server";
import type { Database } from "$lib/types/database.types";
import { normalizeBarcode } from "$lib/utils/barcode/barcode";
import type { FoodCompatibilityFact } from "$lib/utils/food/quality/compatibility";
import { getFoodCompatibilityEvaluation } from "$lib/utils/food/quality/foodCompatibilityEvaluation";
import type { FoodImageAsset } from "$lib/utils/food/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const uniqueStrings = (values: Array<string | null | undefined>) => [
	...new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]),
];

export type SourceAttributionRow = {
	key: string;
	display_name: string;
	homepage_url: string | null;
	terms_url: string | null;
	attribution_text: string | null;
	canonical_license_name: string | null;
	canonical_policy_reviewed_at: string | null;
	canonical_storage_allowed: boolean;
	api_redistribution_allowed: boolean;
};

export type DatasetAttributionRow = {
	key: string;
	source_key: string;
	display_name: string;
	version: string;
	source_url: string;
	license_name: string;
	license_url: string;
	attribution_text: string;
	imported_at: string | null;
	active: boolean;
	import_enabled: boolean;
	license_review_status: string;
};

type ApiV1AssetSourceIdentity = {
	displayName: string;
	sourceUrl: string;
};

export type ApiV1SourceAttributionCatalog = {
	sources: Record<string, ApiV1SourceAttribution>;
	datasetsBySource: Record<string, Record<string, ApiV1SourceAttribution>>;
	datasetSourceKeys: Set<string>;
	assetSources: Record<string, ApiV1AssetSourceIdentity>;
};

const readRequiredAttributionText = (
	value: string | null,
	field: string,
) => {
	const normalized = value?.trim();
	if (!normalized) {
		throw new Error(`Required API source ${field} is unavailable.`);
	}
	return normalized;
};

const hasRequiredAttributionText = (
	value: string | null,
): value is string => Boolean(value?.trim());

const hasCompleteSourceAttribution = (source: SourceAttributionRow) =>
	hasRequiredAttributionText(source.display_name) &&
	hasRequiredAttributionText(source.homepage_url) &&
	hasRequiredAttributionText(source.canonical_license_name) &&
	hasRequiredAttributionText(source.terms_url) &&
	hasRequiredAttributionText(source.attribution_text) &&
	hasRequiredAttributionText(source.canonical_policy_reviewed_at);

const hasCompleteDatasetAttribution = (dataset: DatasetAttributionRow) =>
	hasRequiredAttributionText(dataset.display_name) &&
	hasRequiredAttributionText(dataset.version) &&
	hasRequiredAttributionText(dataset.source_url) &&
	hasRequiredAttributionText(dataset.license_name) &&
	hasRequiredAttributionText(dataset.license_url) &&
	hasRequiredAttributionText(dataset.attribution_text) &&
	hasRequiredAttributionText(dataset.imported_at);

const mapSourceAttributionRow = (
	source: SourceAttributionRow,
): ApiV1SourceAttribution => ({
	source: source.key,
	displayName: readRequiredAttributionText(source.display_name, "name"),
	sourceUrl: readRequiredAttributionText(source.homepage_url, "URL"),
	licenseName: readRequiredAttributionText(
		source.canonical_license_name,
		"license",
	),
	licenseUrl: readRequiredAttributionText(source.terms_url, "license URL"),
	attribution: readRequiredAttributionText(source.attribution_text, "credit"),
	redistributionPolicyReviewedAt: readRequiredAttributionText(
		source.canonical_policy_reviewed_at,
		"policy review date",
	),
	dataset: null,
});

const mapAssetSourceIdentity = (
	source: SourceAttributionRow,
): ApiV1AssetSourceIdentity | null => {
	const displayName = source.display_name.trim();
	const sourceUrl = source.homepage_url?.trim();
	return displayName && sourceUrl ? { displayName, sourceUrl } : null;
};

const normalizeSourceKey = (source: string) => {
	if (source === "community" || source === "community-reviewed") {
		return "shared-catalog";
	}
	return source;
};

const PUBLIC_SOURCE_TAG_FIELDS = new Set([
	"additives",
	"allergens",
	"categories",
	"countries",
	"ingredients",
	"labels",
	"languages",
	"nutrients",
	"packaging",
	"traces",
]);

const PUBLIC_REVISION_TEXT_FIELDS = new Set([
	"productName",
	"brandOwner",
	"category",
	"householdServing",
	"ingredients",
	"allergens",
	"traces",
]);

const PUBLIC_REVISION_FIELD_LABELS: Record<string, string> = {
	productName: "Product name",
	brandOwner: "Brand",
	category: "Category",
	householdServing: "Household serving",
	servingWeightGrams: "Serving weight",
	ingredients: "Ingredients",
	allergens: "Allergens",
	traces: "Precautionary allergen statement",
};

const toPublicSourceReference = (
	source: string,
	reference: string | null | undefined,
) => {
	if (normalizeSourceKey(source) === "shared-catalog") return null;
	const value = reference?.trim();
	if (
		!value ||
		value.length > 240 ||
		/[\\/?#]/.test(value) ||
		/^\w+:\/\//i.test(value)
	) {
		return null;
	}
	return value;
};

const toPublicSourceTagReferences = (references: unknown) =>
	Array.isArray(references)
		? uniqueStrings(
			references.filter(
				(reference): reference is string =>
					typeof reference === "string" &&
					reference.length <= 120 &&
					!/[\\/?#]/.test(reference) &&
					!/\b(?:token|secret|password|authorization)\b/i.test(reference),
			),
		)
		: [];

export const mapApiV1SourceAttributionCatalog = (
	sourceRows: SourceAttributionRow[],
	datasetRows: DatasetAttributionRow[],
): ApiV1SourceAttributionCatalog => {
	const sources: ApiV1SourceAttributionCatalog["sources"] = {};
	const assetSources: ApiV1SourceAttributionCatalog["assetSources"] = {};
	for (const source of sourceRows) {
		const assetSource = mapAssetSourceIdentity(source);
		if (assetSource) assetSources[source.key] = assetSource;
		if (
			source.canonical_storage_allowed &&
			source.api_redistribution_allowed &&
			hasCompleteSourceAttribution(source)
		) {
			sources[source.key] = mapSourceAttributionRow(source);
		}
	}
	const datasetsBySource: ApiV1SourceAttributionCatalog["datasetsBySource"] = {};
	const datasetSourceKeys = new Set<string>();
	for (const dataset of datasetRows) {
		datasetSourceKeys.add(dataset.source_key);
		if (
			!dataset.active ||
			!dataset.import_enabled ||
			dataset.license_review_status !== "approved" ||
			!hasCompleteDatasetAttribution(dataset)
		) {
			continue;
		}
		const source = sources[dataset.source_key];
		if (!source) continue;
		const sourceDatasets = datasetsBySource[dataset.source_key] ?? {};
		sourceDatasets[dataset.key] = {
			...source,
			sourceUrl: dataset.source_url.trim(),
			licenseName: dataset.license_name.trim(),
			licenseUrl: dataset.license_url.trim(),
			attribution: dataset.attribution_text.trim(),
			dataset: {
				key: dataset.key,
				name: dataset.display_name.trim(),
				version: dataset.version.trim(),
				importedAt: dataset.imported_at!.trim(),
			},
		};
		datasetsBySource[dataset.source_key] = sourceDatasets;
	}

	return { sources, datasetsBySource, datasetSourceKeys, assetSources };
};

export const readApiV1SourceAttributionCatalog = async (
	supabase: SupabaseClient<Database>,
): Promise<ApiV1SourceAttributionCatalog> => {
	const [sourceResult, datasetResult] = await Promise.all([
		supabase
			.from("product_data_sources")
			.select(
				"key, display_name, homepage_url, terms_url, attribution_text, canonical_license_name, canonical_policy_reviewed_at, canonical_storage_allowed, api_redistribution_allowed",
			)
			.eq("enabled", true),
		supabase
			.from("generic_food_datasets")
			.select(
				"key, source_key, display_name, version, source_url, license_name, license_url, attribution_text, imported_at, active, import_enabled, license_review_status",
			),
	]);
	if (sourceResult.error) throw sourceResult.error;
	if (datasetResult.error) throw datasetResult.error;

	return mapApiV1SourceAttributionCatalog(
		(sourceResult.data ?? []) as SourceAttributionRow[],
		(datasetResult.data ?? []) as DatasetAttributionRow[],
	);
};

type RepresentedSource = {
	source: string;
	references: Set<string>;
};

const collectRepresentedSources = (record: ApprovedCatalogRecord) => {
	const representedSources = new Map<string, RepresentedSource>();
	for (const source of [
		...record.food.foodNutrients.map((nutrient) => ({
			source: nutrient.source,
			reference: nutrient.sourceReference,
		})),
		...(record.food.foodServings ?? []).map((serving) => ({
			source: serving.source,
			reference: serving.sourceReference,
		})),
		...Object.values(record.fieldProvenance).map((fieldSource) => ({
			source: fieldSource.source,
			reference: fieldSource.sourceReference,
		})),
	]) {
		if (!source.source) continue;
		const sourceKey = normalizeSourceKey(source.source);
		const represented = representedSources.get(sourceKey) ?? {
			source: sourceKey,
			references: new Set<string>(),
		};
		if (source.reference?.trim()) represented.references.add(source.reference.trim());
		representedSources.set(sourceKey, represented);
	}
	return [...representedSources.values()];
};

const readDatasetKeyFromSourceReference = (reference: string) => {
	const separatorIndex = reference.indexOf(":");
	return separatorIndex > 0 ? reference.slice(0, separatorIndex) : null;
};

const selectSourceAttributions = (
	record: ApprovedCatalogRecord,
	catalog: ApiV1SourceAttributionCatalog,
) => {
	const attributions = new Map<string, ApiV1SourceAttribution>();
	const representedSources = collectRepresentedSources(record);
	if (representedSources.length === 0) {
		throw new Error("Required API source attribution is unavailable.");
	}
	for (const representedSource of representedSources) {
		const providerAttribution = catalog.sources[representedSource.source];
		if (!providerAttribution) {
			throw new Error("Required API source attribution is unavailable.");
		}
		if (!catalog.datasetSourceKeys.has(representedSource.source)) {
			attributions.set(representedSource.source, providerAttribution);
			continue;
		}
		const representedDatasetKeys = new Set(
			[...representedSource.references]
				.map(readDatasetKeyFromSourceReference)
				.filter((key): key is string => Boolean(key)),
		);
		if (representedDatasetKeys.size === 0) {
			throw new Error("Required API dataset attribution is unavailable.");
		}
		const datasetCatalog = catalog.datasetsBySource[representedSource.source];
		if (!datasetCatalog) {
			throw new Error("Required API dataset attribution is unavailable.");
		}
		for (const datasetKey of representedDatasetKeys) {
			const datasetAttribution = datasetCatalog[datasetKey];
			if (!datasetAttribution) {
				throw new Error("Required API dataset attribution is unavailable.");
			}
			attributions.set(
				`${representedSource.source}:${datasetKey}`,
				datasetAttribution,
			);
		}
	}
	return [...attributions.values()].sort((left, right) =>
		`${left.source}:${left.dataset?.key ?? ""}`.localeCompare(
			`${right.source}:${right.dataset?.key ?? ""}`,
		),
	);
};

const toSource = (
	source: string,
	reference: string | null | undefined,
	confidence: string | null | undefined,
): ApiV1Source => ({
	source: normalizeSourceKey(source),
	reference: toPublicSourceReference(source, reference),
	confidence: confidence?.trim() || null,
});

type PublicApiImage = FoodImageAsset & {
	licenseUrl: string;
	attributionText: string;
	fetchedAt: string;
};

const toImage = (
	image: PublicApiImage,
	assetSource: ApiV1AssetSourceIdentity,
): ApiV1Image => ({
	role: image.role,
	url: image.imageUrl,
	thumbnailUrl: image.thumbnailUrl ?? null,
	sourceName: assetSource.displayName,
	sourceUrl: assetSource.sourceUrl,
	license: {
		name: image.licenseName,
		url: image.licenseUrl,
		attribution: image.attributionText,
	},
	placement: {
		fitMode: image.fitMode ?? "cover",
		x: image.cropX ?? 50,
		y: image.cropY ?? 50,
		zoom: image.cropZoom ?? 1,
		rotationDegrees: image.rotationDegrees ?? 0,
		version: image.placementVersion ?? 1,
	},
	source: toSource(image.source, image.sourceReference, image.confidence),
	approvedAt: image.approvedAt ?? null,
	retrievedAt: image.fetchedAt,
});

const toWarning = (fact: FoodCompatibilityFact): ApiV1Warning => ({
	code: fact.slug,
	message: fact.label,
	category: fact.category,
	type: fact.factType,
	sourceType: fact.sourceType,
	confidence: fact.confidence,
	sourceText: fact.sourceText,
});

const hasCompleteImageRights = (image: FoodImageAsset): image is PublicApiImage =>
	Boolean(
		image.licenseName.trim() &&
		image.licenseUrl?.trim() &&
		image.attributionText?.trim() &&
		image.fetchedAt?.trim(),
	);

const toCanonicalFieldSource = (
	record: ApprovedCatalogRecord,
	fieldPath: string,
): ApiV1FieldSource | null => {
	const canonical = record.fieldProvenance[fieldPath];
	if (canonical) {
		return {
			...toSource(
				canonical.source,
				canonical.sourceReference,
				canonical.confidence,
			),
			observationId: canonical.observationId,
			observedAt: canonical.observedAt,
			verificationMethod: canonical.verificationMethod,
			reviewState: canonical.reviewState,
		};
	}
	return null;
};

export const mapApprovedCatalogRecordToApiV1Product = (
	record: ApprovedCatalogRecord,
	sourceAttributionCatalog: ApiV1SourceAttributionCatalog,
): ApiV1Product => {
	const ingredientsText = record.food.ingredients?.trim() || null;
	const precautionarySource =
		record.fieldProvenance.traces ?? record.fieldProvenance.allergens ?? null;
	const categorySource = record.category
		? toCanonicalFieldSource(record, "categories")
		: null;
	const sourceAttributions = selectSourceAttributions(
		record,
		sourceAttributionCatalog,
	);
	const appCompatibilityEvaluation = getFoodCompatibilityEvaluation({
		food: record.food,
		policyVersion: record.food.compatibilitySummary?.policyVersion ?? null,
		hasActivePreferences: false,
		policyCoversPreferences: false,
		conflictCount: 0,
	});
	const compatibilityEvaluation: ApiV1CompatibilityEvaluation = {
		version: appCompatibilityEvaluation.version,
		status: appCompatibilityEvaluation.status,
		policyVersion: appCompatibilityEvaluation.policyVersion,
		profileApplied: appCompatibilityEvaluation.profileApplied,
		conflictCount: appCompatibilityEvaluation.conflictCount,
		coverage: appCompatibilityEvaluation.coverage,
	};
	return {
		id: record.id,
		barcode: record.barcode,
		name: record.productName,
		brand: record.brandOwner?.trim() || null,
		category: record.category
			? {
					id: record.category.categoryOptionId,
					name: record.category.label,
					slug: record.category.sourceValue,
					updatedAt: record.category.updatedAt ?? null,
				}
			: null,
		ingredients: {
			text: ingredientsText,
			items: uniqueStrings(record.food.ingredientList ?? []),
			structured: (record.food.structuredIngredients ?? []).map(
				function mapIngredient(
					ingredient,
				): ApiV1Product["ingredients"]["structured"][number] {
					return {
						id: ingredient.id ?? null,
						text: ingredient.text ?? null,
						percent: ingredient.percent ?? null,
						percentEstimate: ingredient.percentEstimate ?? null,
						percentMin: ingredient.percentMin ?? null,
						percentMax: ingredient.percentMax ?? null,
						vegan: ingredient.vegan ?? null,
						vegetarian: ingredient.vegetarian ?? null,
						ingredients: (ingredient.ingredients ?? []).map(mapIngredient),
					};
				},
			),
			analysis: record.food.ingredientAnalysis
				? {
						ingredientTags: uniqueStrings(
							record.food.ingredientAnalysis.ingredientTags,
						),
						analysisTags: uniqueStrings(
							record.food.ingredientAnalysis.analysisTags,
						),
						derivedTraceTags: uniqueStrings(
							record.food.ingredientAnalysis.derivedTraceTags,
						),
						percentAnalysis:
							record.food.ingredientAnalysis.percentAnalysis ?? null,
						percentEstimate:
							record.food.ingredientAnalysis.percentEstimate ?? null,
						percentKnown: record.food.ingredientAnalysis.percentKnown ?? null,
						percentUnknown:
							record.food.ingredientAnalysis.percentUnknown ?? null,
					}
				: null,
			additives: uniqueStrings(record.food.additives ?? []),
			allergens: uniqueStrings(record.food.allergens ?? []),
			traces: uniqueStrings(record.food.traces ?? []),
			precautionaryStatements: (record.food.precautionaryStatements ?? []).map(
				(statement) => ({
					type: statement.type,
					text: statement.text,
					allergens: uniqueStrings(statement.allergens),
					languageCode: statement.languageCode ?? null,
					sourceField: statement.sourceField,
					sourceReference: precautionarySource
						? toPublicSourceReference(
								precautionarySource.source,
								statement.sourceReference,
							)
						: null,
					observationId: statement.observationId ?? null,
					revisionId: statement.revisionId ?? null,
					labelObservedAt: statement.labelObservedAt ?? null,
				}),
			),
			dietaryTags: uniqueStrings(record.food.dietaryTags ?? []),
			labels: uniqueStrings(record.food.labels ?? []),
		},
		packageQuantity: record.food.packageQuantity
			? {
					label: record.food.packageQuantity.label ?? null,
					amount: record.food.packageQuantity.amount ?? null,
					unit: record.food.packageQuantity.unit ?? null,
				}
			: null,
		sourceRecord: record.food.sourceMetadata
			? {
					language: record.food.sourceMetadata.language ?? null,
					languages: uniqueStrings(record.food.sourceMetadata.languages ?? []),
					marketCountries: uniqueStrings(
						record.food.sourceMetadata.marketCountries ?? [],
					),
					revision: record.food.sourceMetadata.revision ?? null,
					schemaVersion: record.food.sourceMetadata.schemaVersion ?? null,
					createdAt: record.food.sourceMetadata.createdAt ?? null,
					publishedAt: record.food.sourceMetadata.publishedAt ?? null,
					availableAt: record.food.sourceMetadata.availableAt ?? null,
					modifiedAt: record.food.sourceMetadata.modifiedAt ?? null,
					updatedAt: record.food.sourceMetadata.updatedAt ?? null,
					discontinuedAt: record.food.sourceMetadata.discontinuedAt ?? null,
					completeness: record.food.sourceMetadata.completeness ?? null,
					qualityTags: uniqueStrings(
						record.food.sourceMetadata.qualityTags ?? [],
					),
					qualityErrorTags: uniqueStrings(
						record.food.sourceMetadata.qualityErrorTags ?? [],
					),
					qualityWarningTags: uniqueStrings(
						record.food.sourceMetadata.qualityWarningTags ?? [],
					),
					obsolete: record.food.sourceMetadata.obsolete ?? null,
					obsoleteSince: record.food.sourceMetadata.obsoleteSince ?? null,
					tagSources: Object.fromEntries(
						Object.entries(record.food.sourceMetadata.tagSources ?? [])
							.filter(([field]) => PUBLIC_SOURCE_TAG_FIELDS.has(field))
							.map(([field, sources]) => [
								field,
								toPublicSourceTagReferences(sources),
							]),
					),
				}
			: null,
		nutrients: [...record.food.foodNutrients]
			.sort((left, right) => left.nutrientId - right.nutrientId)
			.map((nutrient) => ({
				id: nutrient.nutrientId,
				name: nutrient.nutrientName,
				number: nutrient.nutrientNumber?.trim() || null,
				unit: nutrient.unitName,
				amountPer100g: Number.isFinite(nutrient.value) ? nutrient.value : null,
				valueStatus: nutrient.valueOrigin ?? "unknown",
				source: nutrient.source
					? toSource(
							nutrient.source,
							nutrient.sourceReference,
							nutrient.confidence,
						)
					: null,
				quality: {
					sourceValueStatus:
						nutrient.valueStatus ??
						(nutrient.valueOrigin === "derived"
							? "derived"
							: nutrient.value === 0
								? "reported-zero"
								: (nutrient.valueOrigin ?? "unknown")),
					standardError:
						Number.isFinite(nutrient.standardError) &&
						Number(nutrient.standardError) >= 0
							? Number(nutrient.standardError)
							: null,
					sourceNutrientKey: nutrient.sourceNutrientKey?.trim() || null,
					sourceNutrientCode: nutrient.sourceNutrientCode?.trim() || null,
					mappingStatus: nutrient.mappingStatus ?? "unknown",
					mappingMethod: nutrient.mappingMethod?.trim() || null,
					derivationMethod: nutrient.derivationMethod?.trim() || null,
					valueQualifier: nutrient.valueQualifier ?? null,
				},
			})),
		servings: (record.food.foodServings ?? []).map((serving) => {
			const quantity =
				Number.isFinite(serving.amount) && Number(serving.amount) > 0
					? Number(serving.amount)
					: null;
			const grams =
				Number.isFinite(serving.gramWeight) && serving.gramWeight > 0
					? serving.gramWeight
					: null;
			return {
				label: serving.label,
				grams,
				quantity,
				unit: serving.unitKey?.trim() || null,
				gramsPerUnit:
					grams !== null && quantity !== null ? grams / quantity : null,
				isPrimary: serving.isPrimary,
				measureType: serving.measureType?.trim() || null,
				isHouseholdMeasure: serving.isHouseholdMeasure === true,
				sourceMeasureKey: serving.sourceMeasureKey?.trim() || null,
				origin: serving.origin ?? "unknown",
				gramWeightMethod: serving.gramWeightMethod ?? "unknown",
				calculationBasis: serving.calculationBasis?.trim() || null,
				source: serving.source
					? toSource(
							serving.source,
							serving.sourceReference,
							serving.confidence,
						)
					: null,
			};
		}),
		images: record.images.flatMap((image) => {
			if (!hasCompleteImageRights(image)) return [];
			const assetSource =
				sourceAttributionCatalog.assetSources[normalizeSourceKey(image.source)];
			return assetSource ? [toImage(image, assetSource)] : [];
		}),
		warnings: (record.food.compatibilitySummary?.allFacts ?? []).map(toWarning),
		compatibilityEvaluation,
		sourceAttributions,
		catalog: {
			authority: "blendcalc-shared-catalog",
			status: "active",
			verification: record.confidence,
			redistributionPolicy: "approved",
			sourceCount: sourceAttributions.length,
		},
		fieldSources: {
			name: toCanonicalFieldSource(record, "productName"),
			brand: record.brandOwner
				? toCanonicalFieldSource(record, "brandOwner")
				: null,
			category: categorySource,
			ingredients: toCanonicalFieldSource(record, "ingredients"),
			structuredIngredients: toCanonicalFieldSource(
				record,
				"structuredIngredients",
			),
			ingredientAnalysis: toCanonicalFieldSource(record, "ingredientAnalysis"),
			additives: toCanonicalFieldSource(record, "additives"),
			allergens: toCanonicalFieldSource(record, "allergens"),
			traces: toCanonicalFieldSource(record, "traces"),
			precautionaryStatements: toCanonicalFieldSource(
				record,
				"precautionaryStatements",
			),
			dietaryTags: toCanonicalFieldSource(record, "dietaryTags"),
			labels: toCanonicalFieldSource(record, "labels"),
			package: toCanonicalFieldSource(record, "package"),
			sourceMetadata: toCanonicalFieldSource(record, "sourceMetadata"),
		},
		revision: {
			id: record.revision.id,
			number: record.revision.number,
			currentSince: record.revision.labelObservedAt,
			currentSinceBasis: record.revision.labelObservedAt
				? "blendcalc-observed"
				: null,
			labelObservedAt: record.revision.labelObservedAt,
			updatedAt: record.updatedAt,
			lastVerifiedAt: record.lastVerifiedAt,
		},
		links: {
			self: `/api/v1/products/${record.barcode}`,
		},
	};
};

type RevisionHistoryRow =
	Database["public"]["Functions"]["get_blendcalc_product_revision_history_v1"]["Returns"][number];

const toRevisionChange = (
	value: unknown,
): ApiV1ProductRevisionChange | null => {
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;
	const change = value as Record<string, unknown>;
	const field = change.field;
	const changeType = change.changeType;
	const severity = change.severity;
	if (
		typeof field !== "string" ||
		typeof change.label !== "string" ||
		(changeType !== "added" &&
			changeType !== "removed" &&
			changeType !== "changed") ||
		(severity !== "low" && severity !== "medium" && severity !== "high")
	)
		return null;
	const readValue = (candidate: unknown) => {
		if (candidate === null) return null;
		if (PUBLIC_REVISION_TEXT_FIELDS.has(field)) {
			return typeof candidate === "string" && candidate.length <= 20_000
				? candidate
				: undefined;
		}
		if (field === "servingWeightGrams") {
			return typeof candidate === "number" &&
				Number.isFinite(candidate) &&
				candidate >= 0
				? candidate
				: undefined;
		}
		if (/^nutrient:[1-9]\d*$/.test(field)) {
			if (
				typeof candidate !== "object" ||
				Array.isArray(candidate) ||
				candidate === null
			) {
				return undefined;
			}
			const nutrient = candidate as Record<string, unknown>;
			const unit = typeof nutrient.unit === "string"
				? nutrient.unit.trim()
				: "";
			return typeof nutrient.value === "number" &&
				Number.isFinite(nutrient.value) &&
				nutrient.value >= 0 &&
				unit.length > 0 &&
				unit.length <= 32 &&
				/^[A-Za-zµμ%]+$/.test(unit)
				? { value: nutrient.value, unit }
				: undefined;
		}
		return undefined;
	};
	const previousValue = readValue(change.previousValue);
	const newValue = readValue(change.newValue);
	if (previousValue === undefined || newValue === undefined) return null;
	const publicLabel = field.startsWith("nutrient:")
		? `Nutrient ${field.slice("nutrient:".length)}`
		: PUBLIC_REVISION_FIELD_LABELS[field];
	if (!publicLabel) return null;
	return {
		field,
		label: publicLabel,
		changeType,
		previousValue,
		newValue,
		severity,
	};
};

const toRevisionHistoryItem = (
	row: RevisionHistoryRow,
): ApiV1ProductRevisionHistoryItem => ({
	id: row.id,
	number: row.revision_number,
	publishedAt: row.published_at,
	labelObservedAt: row.label_observed_at,
	changes: Array.isArray(row.changes)
		? row.changes.flatMap((change) => {
				const mapped = toRevisionChange(change);
				return mapped ? [mapped] : [];
			})
		: [],
});

export const readApiV1ProductRevisionHistory = async (
	supabase: SupabaseClient<Database>,
	barcodeValue: string,
	input: { limit: number; offset: number },
) => {
	const barcode = normalizeBarcode(barcodeValue);
	if (!barcode) return null;
	const readRows = (limit: number, offset: number) =>
		supabase.rpc("get_blendcalc_product_revision_history_v1", {
			p_barcode: barcode,
			p_limit: limit,
			p_offset: offset,
		});
	const { data, error } = await readRows(input.limit, input.offset);
	if (error) throw error;
	const rows = (data ?? []) as RevisionHistoryRow[];
	if (rows.length === 0) {
		const { data: firstPageData, error: firstPageError } = await readRows(1, 0);
		if (firstPageError) throw firstPageError;
		const firstPage = (firstPageData ?? []) as RevisionHistoryRow[];
		if (firstPage.length === 0) return null;
		return {
			revisions: [],
			pagination: createPagination(
				input.limit,
				input.offset,
				Number(firstPage[0]?.total_count ?? 0),
			),
		};
	}
	return {
		revisions: rows.map(toRevisionHistoryItem),
		pagination: createPagination(
			input.limit,
			input.offset,
			Number(rows[0]?.total_count ?? 0),
		),
	};
};

export const readApiV1ProductByBarcode = async (
	supabase: SupabaseClient<Database>,
	barcode: string,
) => {
	const [record, sourceAttributionCatalog] = await Promise.all([
		getApprovedCatalogRecordByBarcode(supabase, barcode, {
			imageAssociationScope: "canonical-product-only",
		}),
		readApiV1SourceAttributionCatalog(supabase),
	]);
	return record
		? mapApprovedCatalogRecordToApiV1Product(record, sourceAttributionCatalog)
		: null;
};

export const searchApiV1Products = async (
	supabase: SupabaseClient<Database>,
	input: { query: string; limit: number; offset: number },
) => {
	const [page, sourceAttributionCatalog] = await Promise.all([
		searchApprovedCatalogRecordsPage(supabase, input.query, {
			...input,
			imageAssociationScope: "canonical-product-only",
		}),
		readApiV1SourceAttributionCatalog(supabase),
	]);
	return {
		products: page.records.map((record) =>
			mapApprovedCatalogRecordToApiV1Product(record, sourceAttributionCatalog),
		),
		pagination: createPagination(input.limit, input.offset, page.total),
	};
};

export const readApiV1Categories = async (
	supabase: SupabaseClient<Database>,
	input: { limit: number; offset: number },
) => {
	const { data, error, count } = await supabase
		.from("custom_food_category_options")
		.select("id, label, normalized_value, updated_at", { count: "exact" })
		.eq("enabled", true)
		.order("label", { ascending: true })
		.order("id", { ascending: true })
		.range(input.offset, input.offset + input.limit - 1);
	if (error) throw error;
	return {
		categories: (data ?? []).map((row): ApiV1Category => ({
			id: row.id,
			name: row.label,
			slug: row.normalized_value,
			updatedAt: row.updated_at,
		})),
		pagination: createPagination(input.limit, input.offset, count ?? 0),
	};
};

export const createPagination = (
	limit: number,
	offset: number,
	total: number,
): ApiV1Pagination => {
	const loadedThrough = Math.min(total, offset + limit);
	const hasMore = loadedThrough < total;
	return {
		limit,
		offset,
		total,
		hasMore,
		nextOffset: hasMore ? loadedThrough : null,
	};
};

export { BLENDCALC_API_V1 };
