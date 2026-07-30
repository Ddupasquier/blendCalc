import {
	BLENDCALC_API_V1,
	type ApiV1Category,
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
import {
	getFoodCompatibilityEvaluation,
} from "$lib/utils/food/quality/foodCompatibilityEvaluation";
import type { FoodImageAsset } from "$lib/utils/food/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const uniqueStrings = (values: Array<string | null | undefined>) => [
	...new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]),
];

type SourceAttributionRow = {
	key: string;
	display_name: string;
	homepage_url: string | null;
	terms_url: string | null;
	attribution_text: string | null;
	canonical_license_name: string | null;
	api_redistribution_allowed: boolean;
};

type SourceAttributionCatalog = Record<string, ApiV1SourceAttribution>;

const normalizeSourceKey = (source: string) => {
	if (source === "community" || source === "community-reviewed") {
		return "shared-catalog";
	}
	return source;
};

const readSourceAttributionCatalog = async (
	supabase: SupabaseClient<Database>,
): Promise<SourceAttributionCatalog> => {
	const { data, error } = await supabase
		.from("product_data_sources")
		.select(
			"key, display_name, homepage_url, terms_url, attribution_text, canonical_license_name, api_redistribution_allowed",
		)
		.eq("enabled", true)
		.eq("api_redistribution_allowed", true);
	if (error) throw error;
	return Object.fromEntries(
		((data ?? []) as SourceAttributionRow[]).map((source) => [
			source.key,
			{
				source: source.key,
				displayName: source.display_name,
				sourceUrl: source.homepage_url,
				licenseName: source.canonical_license_name,
				licenseUrl: source.terms_url,
				attribution: source.attribution_text,
			},
		]),
	);
};

const collectSourceKeys = (record: ApprovedCatalogRecord) => new Set(
	[
			...record.food.foodNutrients.map((nutrient) => nutrient.source),
			...(record.food.foodServings ?? []).map((serving) => serving.source),
			...Object.values(record.fieldProvenance).map((source) => source.source),
		]
		.filter(Boolean)
		.map((source) => normalizeSourceKey(source as string)),
);

const selectSourceAttributions = (
	record: ApprovedCatalogRecord,
	catalog: SourceAttributionCatalog,
) => [...collectSourceKeys(record)]
	.map((sourceKey) => catalog[sourceKey])
	.filter((source): source is ApiV1SourceAttribution => Boolean(source))
	.sort((left, right) => left.source.localeCompare(right.source));

const toSource = (
	source: string,
	reference: string | null | undefined,
	confidence: string | null | undefined,
): ApiV1Source => ({
	source,
	reference: reference?.trim() || null,
	confidence: confidence?.trim() || null,
});

const toImage = (image: FoodImageAsset): ApiV1Image => ({
	role: image.role,
	url: image.imageUrl,
	thumbnailUrl: image.thumbnailUrl ?? null,
	license: {
		name: image.licenseName,
		url: image.licenseUrl ?? null,
		attribution: image.attributionText ?? null,
	},
	placement: {
		fitMode: image.fitMode ?? "cover",
		x: image.cropX ?? 50,
		y: image.cropY ?? 50,
		zoom: image.cropZoom ?? 1,
		rotationDegrees: image.rotationDegrees ?? 0,
		version: image.placementVersion ?? 1,
	},
	source: toSource(
		image.source,
		image.sourceReference,
		image.confidence,
	),
	approvedAt: image.approvedAt ?? null,
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

const hasCompleteImageRights = (image: FoodImageAsset) =>
	Boolean(
		image.licenseName.trim() &&
		image.licenseUrl?.trim() &&
		image.attributionText?.trim(),
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
	sourceAttributionCatalog: SourceAttributionCatalog = {},
): ApiV1Product => {
	const ingredientsText = record.food.ingredients?.trim() || null;
	const categorySource = record.category
		? toCanonicalFieldSource(record, "categories")
		: null;
	const sourceAttributions = selectSourceAttributions(
		record,
		sourceAttributionCatalog,
	);
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
				function mapIngredient(ingredient): ApiV1Product["ingredients"]["structured"][number] {
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
					percentKnown:
						record.food.ingredientAnalysis.percentKnown ?? null,
					percentUnknown:
						record.food.ingredientAnalysis.percentUnknown ?? null,
				}
				: null,
			additives: uniqueStrings(record.food.additives ?? []),
			allergens: uniqueStrings(record.food.allergens ?? []),
			traces: uniqueStrings(record.food.traces ?? []),
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
				revision: record.food.sourceMetadata.revision ?? null,
				schemaVersion: record.food.sourceMetadata.schemaVersion ?? null,
				createdAt: record.food.sourceMetadata.createdAt ?? null,
				modifiedAt: record.food.sourceMetadata.modifiedAt ?? null,
				updatedAt: record.food.sourceMetadata.updatedAt ?? null,
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
					Object.entries(record.food.sourceMetadata.tagSources ?? {}).map(
						([field, sources]) => [field, uniqueStrings(sources)],
					),
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
				amountPer100g: Number.isFinite(nutrient.value)
					? nutrient.value
					: null,
				valueStatus: nutrient.valueOrigin ?? "unknown",
				source: nutrient.source
					? toSource(
							nutrient.source,
							nutrient.sourceReference,
							nutrient.confidence,
						)
					: null,
			})),
		servings: (record.food.foodServings ?? []).map((serving) => {
			const quantity = Number.isFinite(serving.amount) && Number(serving.amount) > 0
				? Number(serving.amount)
				: null;
			const grams = Number.isFinite(serving.gramWeight) && serving.gramWeight > 0
				? serving.gramWeight
				: null;
			return {
				label: serving.label,
				grams,
				quantity,
				unit: serving.unitKey?.trim() || null,
				gramsPerUnit: grams !== null && quantity !== null
					? grams / quantity
					: null,
				isPrimary: serving.isPrimary,
				source: serving.source
					? toSource(
							serving.source,
							serving.sourceReference,
							serving.confidence,
						)
					: null,
			};
		}),
		images: record.images.filter(hasCompleteImageRights).map(toImage),
		warnings: (record.food.compatibilitySummary?.allFacts ?? []).map(toWarning),
		compatibilityEvaluation: getFoodCompatibilityEvaluation({
			food: record.food,
			policyVersion:
				record.food.compatibilitySummary?.policyVersion ?? null,
			hasActivePreferences: false,
			policyCoversPreferences: false,
			conflictCount: 0,
		}),
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
			ingredientAnalysis: toCanonicalFieldSource(
				record,
				"ingredientAnalysis",
			),
			additives: toCanonicalFieldSource(record, "additives"),
			allergens: toCanonicalFieldSource(record, "allergens"),
			traces: toCanonicalFieldSource(record, "traces"),
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
	const changeType = change.changeType;
	const severity = change.severity;
	if (
		typeof change.field !== "string" ||
		typeof change.label !== "string" ||
		(changeType !== "added" &&
			changeType !== "removed" &&
			changeType !== "changed") ||
		(severity !== "low" &&
			severity !== "medium" &&
			severity !== "high")
	) return null;
	return {
		field: change.field,
		label: change.label,
		changeType,
		previousValue:
			change.previousValue as ApiV1ProductRevisionChange["previousValue"],
		newValue:
			change.newValue as ApiV1ProductRevisionChange["newValue"],
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
	const readRows = (limit: number, offset: number) => supabase.rpc(
		"get_blendcalc_product_revision_history_v1",
		{ p_barcode: barcode, p_limit: limit, p_offset: offset },
	);
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
		getApprovedCatalogRecordByBarcode(supabase, barcode),
		readSourceAttributionCatalog(supabase),
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
		searchApprovedCatalogRecordsPage(supabase, input.query, input),
		readSourceAttributionCatalog(supabase),
	]);
	return {
		products: page.records.map((record) =>
			mapApprovedCatalogRecordToApiV1Product(
				record,
				sourceAttributionCatalog,
			)
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
