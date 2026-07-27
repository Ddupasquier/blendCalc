import type { Database, Json } from "$lib/types/database.types";
import { normalizeBarcode } from "$lib/utils/barcode/barcode";
import type { FoodCompatibilitySummary } from "$lib/utils/food/quality/compatibility";
import {
	hydrateFoodWithNormalizedNutrients,
	type NormalizedNutrientRow,
} from "$lib/utils/food/nutrients/normalizedNutrients";
import { hydrateFoodWithNormalizedServings } from "$lib/utils/food/servings/normalizedServings";
import type { FdcFood, FoodImageAsset } from "$lib/utils/food/types";
import type { IngredientProvenanceFilters } from "$lib/utils/ingredients/ingredientProvenance";
import { tokenizeIngredientSearchText } from "$lib/utils/ingredients/ingredientSearchRelevance";
import { normalizeFoodProductName } from "$lib/utils/products/productNameFormatting.js";
import { selectPreferredFoodImageAsset } from "$lib/utils/storage/supabase/foodImages";
import { readNormalizedNutrientsByParent } from "$lib/utils/storage/supabase/normalizedNutrients";
import { readFoodServingsByParent } from "$lib/utils/storage/supabase/servings";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
	applyCanonicalFoodCategory,
	readFoodCategoryOptions,
	type ResolvedFoodCategory,
} from "./categoryMapping.server";

const SHARED_PRODUCT_SEARCH_CANDIDATE_LIMIT = 100;
const SHARED_PRODUCT_COLUMNS = "id, barcode, product_name, brand_owner, category_option_id, compatibility_summary, canonical_provenance, food, source, source_reference, confidence, created_at, updated_at, last_verified_at";
const FOOD_IMAGE_COLUMNS = "id, barcode, shared_product_id, source, source_reference, image_role, image_url, thumbnail_url, license_name, license_url, attribution_text, confidence, crop_x, crop_y, crop_zoom, fit_mode, placement_version, crop_source, placement_method, placement_suggestion_version, placement_suggestion_confidence, placement_suggestion_accepted_at, approved_at, fetched_at";

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
	| "crop_x"
	| "crop_y"
	| "crop_zoom"
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
	food: FdcFood;
	images: FoodImageAsset[];
};

export type CatalogFieldSource = {
	source: string;
	sourceReference: string | null;
	confidence: string | null;
	verificationMethod: string | null;
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
	cropX: row.crop_x,
	cropY: row.crop_y,
	cropZoom: row.crop_zoom,
	fitMode: row.fit_mode as FoodImageAsset["fitMode"],
	placementVersion: row.placement_version,
	cropSource: row.crop_source as FoodImageAsset["cropSource"],
	placementMethod:
		row.placement_method as FoodImageAsset["placementMethod"],
	suggestionVersion:
		row.placement_suggestion_version ?? undefined,
	suggestionConfidence:
		row.placement_suggestion_confidence === null
			? undefined
			: Number(row.placement_suggestion_confidence),
	suggestionAcceptedAt:
		row.placement_suggestion_accepted_at ?? undefined,
	approvedAt: row.approved_at ?? undefined,
	fetchedAt: row.fetched_at,
});

const readActiveFoodImages = async (
	supabase: SupabaseClient<Database>,
	rows: CatalogProductRow[],
) => {
	if (rows.length === 0) return new Map<string, FoodImageAsset[]>();
	const ids = rows.map((row) => row.id);
	const barcodes = rows.map((row) => row.barcode);
	const [byProductResponse, byBarcodeResponse] = await Promise.all([
		supabase
			.from("food_image_assets")
			.select(FOOD_IMAGE_COLUMNS)
			.eq("status", "active")
			.in("shared_product_id", ids),
		supabase
			.from("food_image_assets")
			.select(FOOD_IMAGE_COLUMNS)
			.eq("status", "active")
			.in("barcode", barcodes),
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
	const imageRowsByProductId = new Map<string, FoodImageRow[]>();
	const imageRowsByBarcode = new Map<string, FoodImageRow[]>();
	for (const image of imageRows.values()) {
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
	for (const product of rows) {
		const matchingRows = new Map(
			[
				...(imageRowsByProductId.get(product.id) ?? []),
				...(imageRowsByBarcode.get(product.barcode) ?? []),
			].map((image) => [image.id, image]),
		);
		const images = [...matchingRows.values()]
			.map(toFoodImageAsset);
		const preferredFrontImage = selectPreferredFoodImageAsset(
			images.filter((image) => image.role === "front"),
		);
		const orderedImages = preferredFrontImage
			? [preferredFrontImage, ...images.filter((image) => image !== preferredFrontImage)]
			: images;
		imagesByProduct.set(product.id, orderedImages);
	}
	return imagesByProduct;
};

type CatalogFieldProvenanceRow = {
	shared_product_id: string;
	field_path: string;
	confidence: string;
	verification_method: string;
	shared_product_observations:
		| {
			source: string;
			source_reference: string | null;
		}
		| Array<{
			source: string;
			source_reference: string | null;
		}>
		| null;
};

const readSelectedFieldProvenance = async (
	supabase: SupabaseClient<Database>,
	productIds: string[],
) => {
	const { data, error } = await supabase
		.from("shared_product_field_provenance")
		.select(
			"shared_product_id, field_path, confidence, verification_method, shared_product_observations(source, source_reference)",
		)
		.in("shared_product_id", productIds)
		.eq("selected", true);
	if (error) throw error;

	const provenanceByProduct = new Map<string, Record<string, CatalogFieldSource>>();
	for (const row of (data ?? []) as CatalogFieldProvenanceRow[]) {
		const observation = Array.isArray(row.shared_product_observations)
			? row.shared_product_observations[0]
			: row.shared_product_observations;
		if (!observation) continue;
		const productProvenance = provenanceByProduct.get(row.shared_product_id) ?? {};
		productProvenance[row.field_path] = {
			source: observation.source,
			sourceReference: observation.source_reference,
			confidence: row.confidence,
			verificationMethod: row.verification_method,
		};
		provenanceByProduct.set(row.shared_product_id, productProvenance);
	}
	return provenanceByProduct;
};

const hydrateCatalogRows = async (
	supabase: SupabaseClient<Database>,
	rows: CatalogProductRow[],
): Promise<ApprovedCatalogRecord[]> => {
	if (rows.length === 0) return [];
	const ids = rows.map((row) => row.id);
	const [
		nutrientRows,
		servingRows,
		categories,
		imagesByProduct,
		fieldProvenanceByProduct,
	] = await Promise.all([
		readNormalizedNutrientsByParent(supabase, "shared_product_id", ids),
		readFoodServingsByParent(supabase, "shared_product_id", ids),
		readFoodCategoryOptions(
			supabase,
			rows.map((row) => row.category_option_id),
		),
		readActiveFoodImages(supabase, rows),
		readSelectedFieldProvenance(supabase, ids),
	]);
	return rows.map((row) => {
		const category = row.category_option_id
			? categories.get(row.category_option_id) ?? null
			: null;
		const images = imagesByProduct.get(row.id) ?? [];
		const baseFood = normalizeFoodProductName({
			...(row.food as unknown as FdcFood),
			categoryOptionId: row.category_option_id ?? undefined,
			compatibilitySummary:
				(row.compatibility_summary as FoodCompatibilitySummary | null) ?? undefined,
			sharedProductId: row.id,
			sharedProductConfidence:
				row.confidence as FdcFood["sharedProductConfidence"],
			customFood: false,
			image: images[0],
		}) as FdcFood;
		const categorizedFood = category
			? applyCanonicalFoodCategory(baseFood, category)
			: baseFood;
		const foodWithNutrients = hydrateFoodWithNormalizedNutrients(
			categorizedFood,
			nutrientRows.get(row.id) ?? [],
		);
		const food = hydrateFoodWithNormalizedServings(
			foodWithNutrients,
			servingRows.get(row.id) ?? [],
		);
		return {
			id: row.id,
			barcode: row.barcode,
			productName: row.product_name,
			brandOwner: row.brand_owner,
			category,
			canonicalProvenance: row.canonical_provenance,
			fieldProvenance: fieldProvenanceByProduct.get(row.id) ?? {},
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
) => {
	const barcode = normalizeBarcode(barcodeValue);
	if (!barcode) return null;
	const { data, error } = await supabase.rpc("get_blendcalc_product_v1", {
		p_barcode: barcode,
	});
	if (error) throw error;
	const row = data?.[0] as CatalogProductRow | undefined;
	if (!row) return null;
	return (await hydrateCatalogRows(supabase, [row]))[0] ?? null;
};

export const searchApprovedCatalogRecordsPage = async (
	supabase: SupabaseClient<Database>,
	query: string,
	options: { limit: number; offset: number },
): Promise<ApprovedCatalogPage> => {
	const terms = tokenizeIngredientSearchText(query).slice(0, 6);
	if (terms.length === 0) return { records: [], total: 0 };
	const { data, error } = await supabase.rpc("search_blendcalc_products_v1", {
		p_query: query,
		p_terms: terms,
		p_limit: options.limit,
		p_offset: options.offset,
	});
	if (error) throw error;
	const rows = (data ?? []) as CatalogProductRow[];
	return {
		records: await hydrateCatalogRows(supabase, rows),
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
	let request = supabase
		.from("shared_products")
		.select(SHARED_PRODUCT_COLUMNS)
		.eq("status", "active")
		.order("product_name", { ascending: true })
		.limit(SHARED_PRODUCT_SEARCH_CANDIDATE_LIMIT);
	if (filters.sourceFilter === "usda") request = request.eq("source", "usda");
	if (filters.sourceFilter === "open-food-facts") {
		request = request.eq("source", "open-food-facts");
	}
	if (filters.sourceFilter === "shared-catalog") {
		request = request.eq("source", "community-reviewed");
	}
	if (filters.sourceFilter === "custom") return [];
	if (filters.trustFilter && filters.trustFilter !== "any") {
		request = request.eq("confidence", filters.trustFilter);
	}
	for (const term of terms) request = request.ilike("search_text", `%${term}%`);
	const { data, error } = await request;
	if (error) throw error;
	return hydrateCatalogRows(supabase, (data ?? []) as CatalogProductRow[]);
};
