import { normalizeBarcode } from "$lib/utils/barcode/barcode";
import type { FdcFood, FoodImageAsset } from "$lib/utils/food/types";

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
	crop_source: FoodImageAsset["cropSource"];
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
	"crop_source",
	"approved_by",
	"approved_at",
	"fetched_at",
].join(", ");

const uniqueStrings = (values: Array<string | null | undefined>) => [
	...new Set(values.filter(Boolean) as string[]),
];

const getFoodBarcode = (food: FdcFood) =>
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
	cropSource: row.crop_source,
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

	if (error || !data) return [];
	return data;
};

export const hydrateFoodsWithCachedImages = async (
	supabase: unknown,
	foods: FdcFood[],
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

	const imageByBarcode = new Map<string, FoodImageAsset>();
	for (const row of barcodeRows) {
		if (row.barcode && !imageByBarcode.has(row.barcode)) {
			imageByBarcode.set(row.barcode, toFoodImageAsset(row));
		}
	}

	const imageBySharedProductId = new Map<string, FoodImageAsset>();
	for (const row of sharedProductRows) {
		if (
			row.shared_product_id &&
			!imageBySharedProductId.has(row.shared_product_id)
		) {
			imageBySharedProductId.set(row.shared_product_id, toFoodImageAsset(row));
		}
	}

	return foods.map((food) => {
		if (food.image) return food;
		const image =
			imageByBarcode.get(getFoodBarcode(food) ?? "") ??
			imageBySharedProductId.get(food.sharedProductId ?? "");
		return image ? { ...food, image } : food;
	});
};
