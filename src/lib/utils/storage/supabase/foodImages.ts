import { normalizeBarcode } from "$lib/utils/barcode/barcode";
import type { FoodItem, FoodImageAsset } from "$lib/utils/food/types";

type FoodImageAssetRow = {
	barcode: string | null;
	shared_product_id: string | null;
	source: FoodImageAsset["source"];
	source_reference: string | null;
	image_role: FoodImageAsset["role"];
	image_url: string;
	thumbnail_url: string | null;
	storage_path: string | null;
	license_name: string;
	license_url: string | null;
	attribution_text: string | null;
	confidence: FoodImageAsset["confidence"];
	crop_x: number;
	crop_y: number;
	crop_zoom: number;
	rotation_degrees: number;
	fit_mode: NonNullable<FoodImageAsset["fitMode"]>;
	placement_version: number;
	crop_source: FoodImageAsset["cropSource"];
	placement_method: FoodImageAsset["placementMethod"];
	placement_suggestion_version: string | null;
	placement_suggestion_confidence: number | null;
	placement_suggestion_accepted_at: string | null;
	approved_by: string | null;
	approved_at: string | null;
	fetched_at: string;
};

type FoodImageQueryClient = {
	from: (table: "food_image_assets") => {
		select: (columns: string) => {
			eq: (column: string, value: string) => {
				eq: (column: string, value: string) => {
					in: (column: string, values: string[]) => {
						order: (
							column: string,
							options: { ascending: boolean },
						) => PromiseLike<{ data: FoodImageAssetRow[] | null; error: unknown }>;
					};
				};
			};
		};
	};
};

const FOOD_IMAGE_SELECT = [
	"barcode",
	"shared_product_id",
	"source",
	"source_reference",
	"image_role",
	"image_url",
	"thumbnail_url",
	"storage_path",
	"license_name",
	"license_url",
	"attribution_text",
	"confidence",
	"crop_x",
	"crop_y",
	"crop_zoom",
	"rotation_degrees",
	"fit_mode",
	"placement_version",
	"crop_source",
	"placement_method",
	"placement_suggestion_version",
	"placement_suggestion_confidence",
	"placement_suggestion_accepted_at",
	"approved_by",
	"approved_at",
	"fetched_at",
].join(", ");

const uniqueStrings = (values: Array<string | null | undefined>) => [
	...new Set(values.filter(Boolean) as string[]),
];

const FOOD_IMAGE_CONFIDENCE_PRIORITY: Record<
	FoodImageAsset["confidence"],
	number
> = {
	"moderator-reviewed": 3,
	"source-verified": 2,
	imported: 1,
};

const getFoodImageTimestamp = (image: FoodImageAsset) => {
	const timestamp = Date.parse(image.approvedAt ?? image.fetchedAt ?? "");
	return Number.isFinite(timestamp) ? timestamp : 0;
};

const deduplicateFoodImageAssets = (images: FoodImageAsset[]) => [
	...new Map(
		images.map((image) => [
			[
				image.source,
				image.sourceReference ?? "",
				image.role,
				image.imageUrl,
			].join(":"),
			image,
		]),
	).values(),
];

export const selectPreferredFoodImageAsset = (
	images: FoodImageAsset[],
): FoodImageAsset | null => {
	if (!images.length) return null;

	return [...images].sort((left, right) => {
		const confidenceDifference =
			FOOD_IMAGE_CONFIDENCE_PRIORITY[right.confidence] -
			FOOD_IMAGE_CONFIDENCE_PRIORITY[left.confidence];
		if (confidenceDifference !== 0) return confidenceDifference;
		return getFoodImageTimestamp(right) - getFoodImageTimestamp(left);
	})[0] ?? null;
};

const getFoodBarcode = (food: FoodItem) =>
	normalizeBarcode(food.barcode ?? food.gtinUpc ?? "");

const toFoodImageAsset = (row: FoodImageAssetRow): FoodImageAsset => ({
	source: row.source,
	sourceReference: row.source_reference ?? undefined,
	role: row.image_role,
	imageUrl: row.image_url,
	thumbnailUrl: row.thumbnail_url ?? undefined,
	storagePath: row.storage_path ?? undefined,
	licenseName: row.license_name,
	licenseUrl: row.license_url ?? undefined,
	attributionText: row.attribution_text ?? undefined,
	confidence: row.confidence,
	cropX: row.crop_x,
	cropY: row.crop_y,
	cropZoom: row.crop_zoom,
	rotationDegrees: row.rotation_degrees as NonNullable<
		FoodImageAsset["rotationDegrees"]
	>,
	fitMode: row.fit_mode,
	placementVersion: row.placement_version,
	cropSource: row.crop_source,
	placementMethod: row.placement_method,
	suggestionVersion: row.placement_suggestion_version ?? undefined,
	suggestionConfidence:
		row.placement_suggestion_confidence === null
			? undefined
			: Number(row.placement_suggestion_confidence),
	suggestionAcceptedAt:
		row.placement_suggestion_accepted_at ?? undefined,
	approvedBy: row.approved_by ?? undefined,
	approvedAt: row.approved_at ?? undefined,
	fetchedAt: row.fetched_at,
});

const readFoodImageRows = async (
	supabaseClient: unknown,
	column: "barcode" | "shared_product_id",
	values: string[],
) => {
	if (!values.length) return [];

	const supabase = supabaseClient as FoodImageQueryClient;
	const { data, error } = await supabase
		.from("food_image_assets")
		.select(FOOD_IMAGE_SELECT)
		.eq("status", "active")
		.eq("image_role", "front")
		.in(column, values)
		.order("fetched_at", { ascending: false });

	if (error) {
		console.warn("Cached food images could not be loaded.", error);
		return [];
	}
	if (!data) return [];
	return data;
};

export const getCachedFoodImageByBarcode = async (
	supabase: unknown,
	barcodeValue: string,
) => {
	const barcode = normalizeBarcode(barcodeValue);
	if (!barcode) return null;

	const rows = await readFoodImageRows(supabase, "barcode", [barcode]);
	return selectPreferredFoodImageAsset(rows.map(toFoodImageAsset));
};

export const hydrateFoodsWithCachedImages = async (
	supabase: unknown,
	foods: FoodItem[],
) => {
	const barcodes = uniqueStrings(foods.map(getFoodBarcode));
	const sharedProductIds = uniqueStrings(
		foods.map((food) => food.sharedProductId),
	);

	const [barcodeRows, sharedProductRows] = await Promise.all([
		readFoodImageRows(supabase, "barcode", barcodes),
		readFoodImageRows(supabase, "shared_product_id", sharedProductIds),
	]);

	if (!barcodeRows.length && !sharedProductRows.length) return foods;

	const imagesByBarcode = new Map<string, FoodImageAsset[]>();
	for (const row of barcodeRows) {
		if (!row.barcode) continue;
		const images = imagesByBarcode.get(row.barcode) ?? [];
		images.push(toFoodImageAsset(row));
		imagesByBarcode.set(row.barcode, images);
	}

	const imagesBySharedProductId = new Map<string, FoodImageAsset[]>();
	for (const row of sharedProductRows) {
		if (!row.shared_product_id) continue;
		const images = imagesBySharedProductId.get(row.shared_product_id) ?? [];
		images.push(toFoodImageAsset(row));
		imagesBySharedProductId.set(row.shared_product_id, images);
	}

	return foods.map((food) => {
		const image = selectPreferredFoodImageAsset(
			deduplicateFoodImageAssets([
				...(imagesByBarcode.get(getFoodBarcode(food) ?? "") ?? []),
				...(imagesBySharedProductId.get(food.sharedProductId ?? "") ?? []),
			]),
		);
		return image ? { ...food, image } : food;
	});
};
