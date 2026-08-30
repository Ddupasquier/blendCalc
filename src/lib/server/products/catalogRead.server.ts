import type { Database, Json } from "$lib/types/database.types";
import { normalizeBarcode } from "$lib/utils/barcode/barcode";
import type { FoodCompatibilitySummary } from "$lib/utils/food/quality/compatibility";
import { hydrateFoodWithNormalizedNutrients } from "$lib/utils/food/nutrients/normalizedNutrients";
import { hydrateFoodWithNormalizedServings } from "$lib/utils/food/servings/normalizedServings";
import type {
	FoodItem,
	FoodImageAsset,
	FoodPrecautionaryStatement,
} from "$lib/utils/food/types";
import type { IngredientProvenanceFilters } from "$lib/utils/ingredients/ingredientProvenance";
import { tokenizeIngredientSearchText } from "$lib/utils/ingredients/ingredientSearchRelevance";
import { normalizeFoodProductName } from "$lib/utils/products/productNameFormatting.js";
import { selectPreferredFoodImageAsset } from "$lib/utils/storage/supabase/foodImages";
import { applyDatabaseQueryAbortSignal } from "$lib/utils/storage/supabase/databaseQueryAbortSignal";
import { readNormalizedNutrientsByParent } from "$lib/utils/storage/supabase/normalizedNutrients";
import { readFoodServingsByParent } from "$lib/utils/storage/supabase/servings";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
	applyCanonicalFoodCategory,
	readFoodCategoryOptions,
	type ResolvedFoodCategory,
} from "./categoryMapping.server";
import {
	readSelectedCatalogFieldProvenance,
	toFoodFieldProvenance,
	type CatalogFieldSource,
} from "./catalogFieldProvenance.server";
import {
	readActiveProductIdsMatchingSafetyAlertMetadata,
	readActiveProductSafetyAlertsByProduct,
} from "./productSafetyAlerts.server";

const SHARED_PRODUCT_SEARCH_CANDIDATE_LIMIT = 100;
const SHARED_PRODUCT_COLUMNS =
	"id, barcode, product_name, brand_owner, category_option_id, compatibility_summary, canonical_provenance, food, source, source_reference, confidence, created_at, updated_at, last_verified_at";
const FOOD_IMAGE_COLUMNS =
	"id, barcode, shared_product_id, source, source_reference, image_role, image_url, thumbnail_url, license_name, license_url, attribution_text, confidence, canonical_status, canonical_selection_method, canonical_selected_at, crop_x, crop_y, crop_zoom, rotation_degrees, fit_mode, placement_version, crop_source, placement_method, placement_suggestion_version, placement_suggestion_confidence, placement_suggestion_accepted_at, approved_at, fetched_at";
type SharedProductRow = Pick<
	Database["public"]["Tables"]["shared_products"]["Row"],
	| "id"
	| "barcode"
	| "product_name"
	| "brand_owner"
	| "category_option_id"
	| "compatibility_summary"
	| "canonical_provenance"
	| "food"
	| "source"
	| "source_reference"
	| "confidence"
	| "created_at"
	| "updated_at"
	| "last_verified_at"
>;

type ProductRevision = {
	id: string | null;
	number: number | null;
	createdAt: string | null;
	labelObservedAt: string | null;
};

type CatalogProductRow = SharedProductRow & {
	current_revision_id?: string | null;
	current_revision_number?: number | null;
	revision_created_at?: string | null;
	label_observed_at?: string | null;
	total_count?: number;
};

type FoodImageRow = Pick<
	Database["public"]["Tables"]["food_image_assets"]["Row"],
	| "id"
	| "barcode"
	| "shared_product_id"
	| "source"
	| "source_reference"
	| "image_role"
	| "image_url"
	| "thumbnail_url"
	| "license_name"
	| "license_url"
	| "attribution_text"
	| "confidence"
	| "canonical_status"
	| "canonical_selection_method"
	| "canonical_selected_at"
	| "crop_x"
	| "crop_y"
	| "crop_zoom"
	| "rotation_degrees"
	| "fit_mode"
	| "placement_version"
	| "crop_source"
	| "placement_method"
	| "placement_suggestion_version"
	| "placement_suggestion_confidence"
	| "placement_suggestion_accepted_at"
	| "approved_at"
	| "fetched_at"
>;

export type CatalogImageAssociationScope =
	"canonical-product-only" | "canonical-and-barcode-fallback";

type CatalogReadOptions = {
	imageAssociationScope?: CatalogImageAssociationScope;
	databaseAbortSignal?: AbortSignal;
};

type PrecautionaryStatementRow = Pick<
	Database["public"]["Tables"]["product_precautionary_statements"]["Row"],
	| "shared_product_id"
	| "statement_type"
	| "statement_text"
	| "normalized_allergens"
	| "language_code"
	| "source_field"
	| "source_reference"
	| "source_observation_id"
	| "shared_product_revision_id"
	| "label_observed_at"
	| "created_at"
>;

export type ApprovedCatalogRecord = {
	id: string;
	barcode: string;
	productName: string;
	brandOwner: string | null;
	category: ResolvedFoodCategory | null;
	canonicalProvenance: Json;
	fieldProvenance: Record<string, CatalogFieldSource>;
	source: string;
	sourceReference: string | null;
	confidence: string;
	createdAt: string;
	updatedAt: string;
	lastVerifiedAt: string | null;
	revision: ProductRevision;
	food: FoodItem;
	images: FoodImageAsset[];
};

export type ApprovedCatalogPage = {
	records: ApprovedCatalogRecord[];
	total: number;
};

const toFoodImageAsset = (row: FoodImageRow): FoodImageAsset => ({
	source: row.source as FoodImageAsset["source"],
	sourceReference: row.source_reference ?? undefined,
	role: row.image_role as FoodImageAsset["role"],
	imageUrl: row.image_url,
	thumbnailUrl: row.thumbnail_url ?? undefined,
	licenseName: row.license_name,
	licenseUrl: row.license_url ?? undefined,
	attributionText: row.attribution_text ?? undefined,
	confidence: row.confidence as FoodImageAsset["confidence"],
	canonicalStatus: row.canonical_status as NonNullable<
		FoodImageAsset["canonicalStatus"]
	>,
	canonicalSelectionMethod:
		(row.canonical_selection_method as FoodImageAsset["canonicalSelectionMethod"]) ??
		undefined,
	canonicalSelectedAt: row.canonical_selected_at ?? undefined,
	cropX: row.crop_x,
	cropY: row.crop_y,
	cropZoom: row.crop_zoom,
	rotationDegrees: row.rotation_degrees as NonNullable<
		FoodImageAsset["rotationDegrees"]
	>,
	fitMode: row.fit_mode as FoodImageAsset["fitMode"],
	placementVersion: row.placement_version,
	cropSource: row.crop_source as FoodImageAsset["cropSource"],
	placementMethod: row.placement_method as FoodImageAsset["placementMethod"],
	suggestionVersion: row.placement_suggestion_version ?? undefined,
	suggestionConfidence:
		row.placement_suggestion_confidence === null
			? undefined
			: Number(row.placement_suggestion_confidence),
	suggestionAcceptedAt: row.placement_suggestion_accepted_at ?? undefined,
	approvedAt: row.approved_at ?? undefined,
	fetchedAt: row.fetched_at,
});

const readActiveFoodImages = async (
	supabase: SupabaseClient<Database>,
	rows: CatalogProductRow[],
	options: CatalogReadOptions = {},
) => {
	if (rows.length === 0) return new Map<string, FoodImageAsset[]>();
	const ids = rows.map((row) => row.id);
	const barcodes = rows.map((row) => row.barcode);
	const includeBarcodeFallbacks =
		options.imageAssociationScope !== "canonical-product-only";
	const byProductQuery = applyDatabaseQueryAbortSignal(
		supabase
			.from("food_image_assets")
			.select(FOOD_IMAGE_COLUMNS)
			.eq("status", "active")
			.in("shared_product_id", ids),
		options.databaseAbortSignal,
	);
	const byBarcodeQuery = includeBarcodeFallbacks
		? applyDatabaseQueryAbortSignal(
				supabase
					.from("food_image_assets")
					.select(FOOD_IMAGE_COLUMNS)
					.eq("status", "active")
					.in("barcode", barcodes),
				options.databaseAbortSignal,
			)
		: Promise.resolve({ data: [], error: null });
	const [byProductResponse, byBarcodeResponse] = await Promise.all([
		byProductQuery,
		byBarcodeQuery,
	]);
	if (byProductResponse.error) throw byProductResponse.error;
	if (byBarcodeResponse.error) throw byBarcodeResponse.error;

	const imageRows = new Map<string, FoodImageRow>();
	for (const row of [
		...(byProductResponse.data ?? []),
		...(byBarcodeResponse.data ?? []),
	] as FoodImageRow[]) {
		imageRows.set(row.id, row);
	}
	if (
		options.imageAssociationScope === "canonical-product-only" &&
		imageRows.size > 0
	) {
		const holdQuery = supabase
			.from("blendcalc_api_publication_holds")
			.select("food_image_asset_id")
			.is("released_at", null)
			.in("food_image_asset_id", [...imageRows.keys()]);
		const { data: activeHolds, error: holdError } =
			await applyDatabaseQueryAbortSignal(
				holdQuery,
				options.databaseAbortSignal,
			);
		if (holdError) throw holdError;
		removeHeldImagesFromPublicCatalog(
			imageRows,
			(activeHolds ?? []).map((hold) => hold.food_image_asset_id),
		);
	}
	return associateCatalogImagesWithProducts(
		rows,
		[...imageRows.values()],
		options.imageAssociationScope,
	);
};

export const removeHeldImagesFromPublicCatalog = (
	imageRows: Map<string, FoodImageRow>,
	heldImageIds: Array<string | null>,
) => {
	for (const heldImageId of heldImageIds) {
		if (heldImageId) imageRows.delete(heldImageId);
	}
};

export const associateCatalogImagesWithProducts = (
	products: CatalogProductRow[],
	images: FoodImageRow[],
	imageAssociationScope: CatalogImageAssociationScope = "canonical-and-barcode-fallback",
) => {
	const includeBarcodeFallbacks =
		imageAssociationScope !== "canonical-product-only";
	const imageRowsByProductId = new Map<string, FoodImageRow[]>();
	const imageRowsByBarcode = new Map<string, FoodImageRow[]>();
	for (const image of images) {
		if (
			imageAssociationScope === "canonical-product-only" &&
			image.image_role === "front" &&
			image.canonical_status !== "selected"
		) {
			continue;
		}
		if (image.shared_product_id) {
			const productImages =
				imageRowsByProductId.get(image.shared_product_id) ?? [];
			productImages.push(image);
			imageRowsByProductId.set(image.shared_product_id, productImages);
		}
		if (image.barcode) {
			const barcodeImages = imageRowsByBarcode.get(image.barcode) ?? [];
			barcodeImages.push(image);
			imageRowsByBarcode.set(image.barcode, barcodeImages);
		}
	}

	const imagesByProduct = new Map<string, FoodImageAsset[]>();
	for (const product of products) {
		const matchingRows = new Map(
			[
				...(imageRowsByProductId.get(product.id) ?? []),
				...(includeBarcodeFallbacks
					? (imageRowsByBarcode.get(product.barcode) ?? [])
					: []),
			].map((image) => [image.id, image]),
		);
		const images = [...matchingRows.values()].map(toFoodImageAsset);
		const preferredFrontImage = selectPreferredFoodImageAsset(
			images.filter((image) => image.role === "front"),
		);
		const orderedImages = preferredFrontImage
			? [
					preferredFrontImage,
					...images.filter((image) => image !== preferredFrontImage),
				]
			: images;
		imagesByProduct.set(product.id, orderedImages);
	}
	return imagesByProduct;
};

const readPrecautionaryStatements = async (
	supabase: SupabaseClient<Database>,
	productIds: string[],
	databaseAbortSignal?: AbortSignal,
) => {
	const databaseQuery = supabase
		.from("product_precautionary_statements")
		.select(
			"shared_product_id, statement_type, statement_text, normalized_allergens, language_code, source_field, source_reference, source_observation_id, shared_product_revision_id, label_observed_at, created_at",
		)
		.in("shared_product_id", productIds)
		.order("created_at", { ascending: true });
	const { data, error } = await applyDatabaseQueryAbortSignal(
		databaseQuery,
		databaseAbortSignal,
	);
	if (error) throw error;

	const statementsByProduct = new Map<string, FoodPrecautionaryStatement[]>();
	for (const row of (data ?? []) as PrecautionaryStatementRow[]) {
		if (!row.shared_product_id) continue;
		const statements = statementsByProduct.get(row.shared_product_id) ?? [];
		statements.push({
			type: row.statement_type as FoodPrecautionaryStatement["type"],
			text: row.statement_text,
			allergens: [...row.normalized_allergens],
			languageCode: row.language_code ?? undefined,
			sourceField: row.source_field,
			sourceReference: row.source_reference ?? undefined,
			observationId: row.source_observation_id ?? undefined,
			revisionId: row.shared_product_revision_id ?? undefined,
			labelObservedAt: row.label_observed_at ?? undefined,
		});
		statementsByProduct.set(row.shared_product_id, statements);
	}
	return statementsByProduct;
};

const hydrateCatalogRows = async (
	supabase: SupabaseClient<Database>,
	rows: CatalogProductRow[],
	options: CatalogReadOptions = {},
): Promise<ApprovedCatalogRecord[]> => {
	if (rows.length === 0) return [];
	const ids = rows.map((row) => row.id);
	const [
		nutrientRows,
		servingRows,
		categories,
		imagesByProduct,
		fieldProvenanceByProduct,
		precautionaryStatementsByProduct,
		safetyAlertsByProduct,
	] = await Promise.all([
		readNormalizedNutrientsByParent(
			supabase,
			"shared_product_id",
			ids,
			options.databaseAbortSignal,
		),
		readFoodServingsByParent(
			supabase,
			"shared_product_id",
			ids,
			options.databaseAbortSignal,
		),
		readFoodCategoryOptions(
			supabase,
			rows.map((row) => row.category_option_id),
			options.databaseAbortSignal,
		),
		readActiveFoodImages(supabase, rows, options),
		readSelectedCatalogFieldProvenance(
			supabase,
			ids,
			options.databaseAbortSignal,
		),
		readPrecautionaryStatements(supabase, ids, options.databaseAbortSignal),
		readActiveProductSafetyAlertsByProduct(
			ids,
			supabase,
			options.databaseAbortSignal,
		),
	]);
	return rows.map((row) => {
		const fieldProvenance = fieldProvenanceByProduct.get(row.id) ?? {};
		const category = row.category_option_id
			? (categories.get(row.category_option_id) ?? null)
			: null;
		const images = imagesByProduct.get(row.id) ?? [];
		const baseFood = normalizeFoodProductName({
			...(row.food as unknown as FoodItem),
			categoryOptionId: row.category_option_id ?? undefined,
			compatibilitySummary:
				(row.compatibility_summary as FoodCompatibilitySummary | null) ??
				undefined,
			sharedProductId: row.id,
			sharedProductConfidence:
				row.confidence as FoodItem["sharedProductConfidence"],
			customFood: false,
			image: images[0],
			precautionaryStatements:
				precautionaryStatementsByProduct.get(row.id) ??
				(row.food as unknown as FoodItem).precautionaryStatements,
			safetyAlerts: safetyAlertsByProduct.get(row.id) ?? [],
		}) as FoodItem;
		const categorizedFood = category
			? applyCanonicalFoodCategory(baseFood, category)
			: baseFood;
		const foodWithNutrients = hydrateFoodWithNormalizedNutrients(
			categorizedFood,
			nutrientRows.get(row.id) ?? [],
		);
		const food = {
			...hydrateFoodWithNormalizedServings(
				foodWithNutrients,
				servingRows.get(row.id) ?? [],
			),
			fieldProvenance: toFoodFieldProvenance(fieldProvenance),
		};
		return {
			id: row.id,
			barcode: row.barcode,
			productName: row.product_name,
			brandOwner: row.brand_owner,
			category,
			canonicalProvenance: row.canonical_provenance,
			fieldProvenance,
			source: row.source,
			sourceReference: row.source_reference,
			confidence: row.confidence,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
			lastVerifiedAt: row.last_verified_at,
			revision: {
				id: row.current_revision_id ?? null,
				number: row.current_revision_number ?? null,
				createdAt: row.revision_created_at ?? null,
				labelObservedAt: row.label_observed_at ?? null,
			},
			food,
			images,
		};
	});
};

export const getApprovedCatalogRecordByBarcode = async (
	supabase: SupabaseClient<Database>,
	barcodeValue: string,
	options: CatalogReadOptions = {},
) => {
	const barcode = normalizeBarcode(barcodeValue);
	if (!barcode) return null;
	const databaseQuery = supabase.rpc("get_blendcalc_api_product_v1", {
		p_barcode: barcode,
	});
	const { data, error } = await applyDatabaseQueryAbortSignal(
		databaseQuery,
		options.databaseAbortSignal,
	);
	if (error) throw error;
	const row = data?.[0] as CatalogProductRow | undefined;
	if (!row) return null;
	return (await hydrateCatalogRows(supabase, [row], options))[0] ?? null;
};

export const getActiveCanonicalCatalogRecordByBarcode = async (
	supabase: SupabaseClient<Database>,
	barcodeValue: string,
	options: CatalogReadOptions = {},
) => {
	const barcode = normalizeBarcode(barcodeValue);
	if (!barcode) return null;
	const { data, error } = await supabase
		.from("shared_products")
		.select(SHARED_PRODUCT_COLUMNS)
		.eq("status", "active")
		.eq("barcode", barcode)
		.maybeSingle();
	if (error) throw error;
	if (!data) return null;
	return (
		(
			await hydrateCatalogRows(supabase, [data as CatalogProductRow], options)
		)[0] ?? null
	);
};

export const getApprovedCatalogRecordByApplicationFoodId = async (
	supabase: SupabaseClient<Database>,
	foodId: number,
) => {
	if (!Number.isSafeInteger(foodId) || foodId <= 0) return null;
	const { data, error } = await supabase
		.from("shared_products")
		.select(SHARED_PRODUCT_COLUMNS)
		.eq("status", "active")
		.eq("food->>fdcId", String(foodId))
		.limit(1);
	if (error) throw error;
	const row = data?.[0] as CatalogProductRow | undefined;
	if (!row) return null;
	return (await hydrateCatalogRows(supabase, [row]))[0] ?? null;
};

export const searchApprovedCatalogRecordsPage = async (
	supabase: SupabaseClient<Database>,
	query: string,
	options: {
		limit: number;
		offset: number;
		imageAssociationScope?: CatalogImageAssociationScope;
		databaseAbortSignal?: AbortSignal;
	},
): Promise<ApprovedCatalogPage> => {
	const terms = tokenizeIngredientSearchText(query).slice(0, 6);
	if (terms.length === 0) return { records: [], total: 0 };
	const databaseQuery = supabase.rpc("search_blendcalc_api_products_v1", {
		p_query: query,
		p_terms: terms,
		p_limit: options.limit,
		p_offset: options.offset,
	});
	const { data, error } = await applyDatabaseQueryAbortSignal(
		databaseQuery,
		options.databaseAbortSignal,
	);
	if (error) throw error;
	const rows = (data ?? []) as CatalogProductRow[];
	return {
		records: await hydrateCatalogRows(supabase, rows, options),
		total: Number(rows[0]?.total_count ?? 0),
	};
};

export const searchApprovedCatalogRecords = async (
	supabase: SupabaseClient<Database>,
	query: string,
	filters: IngredientProvenanceFilters = {},
) => {
	const terms = tokenizeIngredientSearchText(query).slice(0, 6);
	if (terms.length === 0) return [];
	const applyFilters = <
		Request extends {
			eq: (column: string, value: string) => Request;
		},
	>(
		request: Request,
	) => {
		let filteredRequest = request;
		if (filters.sourceFilter === "usda") {
			filteredRequest = filteredRequest.eq("source", "usda");
		}
		if (filters.sourceFilter === "open-food-facts") {
			filteredRequest = filteredRequest.eq("source", "open-food-facts");
		}
		if (filters.sourceFilter === "shared-catalog") {
			filteredRequest = filteredRequest.eq("source", "community-reviewed");
		}
		if (filters.trustFilter && filters.trustFilter !== "any") {
			filteredRequest = filteredRequest.eq("confidence", filters.trustFilter);
		}
		return filteredRequest;
	};
	if (filters.sourceFilter === "custom") return [];

	let metadataRequest = applyFilters(
		supabase
			.from("shared_products")
			.select(SHARED_PRODUCT_COLUMNS)
			.eq("status", "active")
			.order("product_name", { ascending: true })
			.limit(SHARED_PRODUCT_SEARCH_CANDIDATE_LIMIT),
	);
	for (const term of terms) {
		metadataRequest = metadataRequest.ilike("search_text", `%${term}%`);
	}

	const matchingSafetyProductIds =
		await readActiveProductIdsMatchingSafetyAlertMetadata(terms, supabase);
	const safetyProductRequest =
		matchingSafetyProductIds.length === 0
			? Promise.resolve({ data: [], error: null })
			: applyFilters(
					supabase
						.from("shared_products")
						.select(SHARED_PRODUCT_COLUMNS)
						.eq("status", "active")
						.in("id", matchingSafetyProductIds)
						.order("product_name", { ascending: true })
						.limit(SHARED_PRODUCT_SEARCH_CANDIDATE_LIMIT),
				);
	const [metadataResponse, safetyResponse] = await Promise.all([
		metadataRequest,
		safetyProductRequest,
	]);
	if (metadataResponse.error) throw metadataResponse.error;
	if (safetyResponse.error) throw safetyResponse.error;

	const rowsById = new Map<string, CatalogProductRow>();
	for (const row of [
		...(metadataResponse.data ?? []),
		...(safetyResponse.data ?? []),
	] as CatalogProductRow[]) {
		rowsById.set(row.id, row);
	}
	if (rowsById.size === 0) {
		const partialSafetyProductIds =
			await readActiveProductIdsMatchingSafetyAlertMetadata(
				terms,
				supabase,
				"any",
			);
		const partialMetadataRequest = applyFilters(
			supabase
				.from("shared_products")
				.select(SHARED_PRODUCT_COLUMNS)
				.eq("status", "active")
				.or(terms.map((term) => `search_text.ilike.%${term}%`).join(","))
				.order("product_name", { ascending: true })
				.limit(SHARED_PRODUCT_SEARCH_CANDIDATE_LIMIT),
		);
		const partialSafetyRequest =
			partialSafetyProductIds.length === 0
				? Promise.resolve({ data: [], error: null })
				: applyFilters(
						supabase
							.from("shared_products")
							.select(SHARED_PRODUCT_COLUMNS)
							.eq("status", "active")
							.in("id", partialSafetyProductIds)
							.order("product_name", { ascending: true })
							.limit(SHARED_PRODUCT_SEARCH_CANDIDATE_LIMIT),
					);
		const [partialMetadataResponse, partialSafetyResponse] = await Promise.all([
			partialMetadataRequest,
			partialSafetyRequest,
		]);
		if (partialMetadataResponse.error) throw partialMetadataResponse.error;
		if (partialSafetyResponse.error) throw partialSafetyResponse.error;
		for (const row of [
			...(partialMetadataResponse.data ?? []),
			...(partialSafetyResponse.data ?? []),
		] as CatalogProductRow[]) {
			rowsById.set(row.id, row);
		}
	}
	return hydrateCatalogRows(supabase, [...rowsById.values()]);
};
