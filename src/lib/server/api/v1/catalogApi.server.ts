import { BLENDCALC_API_V1, type ApiV1Category, type ApiV1Image, type ApiV1Pagination, type ApiV1Product, type ApiV1Source, type ApiV1Warning } from "$lib/api/v1/types";
import {
	getApprovedCatalogRecordByBarcode,
	searchApprovedCatalogRecordsPage,
	type ApprovedCatalogRecord,
} from "$lib/server/products/catalogRead.server";
import type { Database } from "$lib/types/database.types";
import type { FoodCompatibilityFact } from "$lib/utils/food/quality/compatibility";
import type { FoodFieldSource, FoodImageAsset } from "$lib/utils/food/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const uniqueStrings = (values: Array<string | null | undefined>) => [
	...new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]),
];

const toSource = (
	source: string,
	reference: string | null | undefined,
	confidence: string | null | undefined,
): ApiV1Source => ({
	source,
	reference: reference?.trim() || null,
	confidence: confidence?.trim() || null,
});

const toFieldSource = (
	fieldSource: FoodFieldSource | undefined,
	fallback: ApiV1Source,
) => fieldSource
	? toSource(fieldSource.source, fieldSource.sourceReference, fieldSource.confidence)
	: fallback;

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
	confidence: fact.confidence,
	sourceText: fact.sourceText,
});

export const mapApprovedCatalogRecordToApiV1Product = (
	record: ApprovedCatalogRecord,
): ApiV1Product => {
	const productSource = toSource(
		record.source,
		record.sourceReference,
		record.confidence,
	);
	const ingredientsText = record.food.ingredients?.trim() || null;
	const categorySource = record.category
		? toFieldSource(record.food.fieldProvenance?.categories, productSource)
		: null;
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
					updatedAt: null,
				}
			: null,
		ingredients: {
			text: ingredientsText,
			allergens: uniqueStrings(record.food.allergens ?? []),
			traces: uniqueStrings(record.food.traces ?? []),
			dietaryTags: uniqueStrings(record.food.dietaryTags ?? []),
		},
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
				valueStatus: nutrient.valueOrigin ?? "reported",
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
		images: record.images.map(toImage),
		warnings: (record.food.compatibilitySummary?.allFacts ?? []).map(toWarning),
		fieldSources: {
			name: productSource,
			brand: record.brandOwner ? productSource : null,
			category: categorySource,
			ingredients: ingredientsText ? productSource : null,
		},
		revision: {
			id: record.revision.id,
			number: record.revision.number,
			currentSince: record.revision.createdAt ?? record.createdAt,
			labelObservedAt: record.revision.labelObservedAt,
			updatedAt: record.updatedAt,
			lastVerifiedAt: record.lastVerifiedAt,
		},
		links: {
			self: `/api/v1/products/${record.barcode}`,
		},
	};
};

export const readApiV1ProductByBarcode = async (
	supabase: SupabaseClient<Database>,
	barcode: string,
) => {
	const record = await getApprovedCatalogRecordByBarcode(supabase, barcode);
	return record ? mapApprovedCatalogRecordToApiV1Product(record) : null;
};

export const searchApiV1Products = async (
	supabase: SupabaseClient<Database>,
	input: { query: string; limit: number; offset: number },
) => {
	const page = await searchApprovedCatalogRecordsPage(supabase, input.query, input);
	return {
		products: page.records.map(mapApprovedCatalogRecordToApiV1Product),
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
