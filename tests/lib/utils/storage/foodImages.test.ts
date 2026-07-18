import { describe, expect, it } from "vitest";
import {
	getCachedFoodImageByBarcode,
	hydrateFoodsWithCachedImages,
	selectPreferredFoodImageAsset,
} from "$lib/utils/storage/supabase/foodImages";
import type { FdcFood, FoodImageAsset } from "$lib/utils/food/types";

const makeImage = (
	overrides: Partial<FoodImageAsset>,
): FoodImageAsset => ({
	source: "open-food-facts",
	sourceReference: "00021130493609",
	role: "front",
	imageUrl: "https://example.com/front.jpg",
	licenseName: "Example license",
	confidence: "imported",
	fetchedAt: "2026-07-18T12:00:00.000Z",
	...overrides,
});

const makeImageRow = (image: FoodImageAsset) => ({
	barcode: "00021130493609",
	shared_product_id: null,
	source: image.source,
	source_reference: image.sourceReference ?? null,
	image_role: image.role,
	image_url: image.imageUrl,
	thumbnail_url: image.thumbnailUrl ?? null,
	storage_path: image.storagePath ?? null,
	license_name: image.licenseName,
	license_url: image.licenseUrl ?? null,
	attribution_text: image.attributionText ?? null,
	confidence: image.confidence,
	crop_x: image.cropX ?? 50,
	crop_y: image.cropY ?? 50,
	crop_zoom: image.cropZoom ?? 1,
	crop_source: image.cropSource ?? "auto",
	approved_by: image.approvedBy ?? null,
	approved_at: image.approvedAt ?? null,
	fetched_at: image.fetchedAt ?? "2026-07-18T12:00:00.000Z",
});

const makeImageQueryClient = (rows: ReturnType<typeof makeImageRow>[]) => ({
	from: () => ({
		select: () => ({
			eq: () => ({
				eq: () => ({
					in: () => ({
						order: async () => ({ data: rows, error: null }),
					}),
				}),
			}),
		}),
	}),
});

describe("food image selection", () => {
	it("prefers moderator-reviewed images over newer imported images", () => {
		const imported = makeImage({
			fetchedAt: "2026-07-18T13:00:00.000Z",
		});
		const moderated = makeImage({
			source: "community-reviewed",
			sourceReference: "approved/00021130493609/front.jpg",
			imageUrl: "https://example.com/approved/front.jpg",
			confidence: "moderator-reviewed",
			approvedAt: "2026-07-18T11:00:00.000Z",
		});

		expect(selectPreferredFoodImageAsset([imported, moderated])).toBe(
			moderated,
		);
	});

	it("uses the newest image when confidence is equal", () => {
		const older = makeImage({ fetchedAt: "2026-07-17T12:00:00.000Z" });
		const newer = makeImage({ fetchedAt: "2026-07-18T12:00:00.000Z" });

		expect(selectPreferredFoodImageAsset([older, newer])).toBe(newer);
	});

	it("returns null when no image is available", () => {
		expect(selectPreferredFoodImageAsset([])).toBeNull();
	});

	it("reads the preferred image from the database cache", async () => {
		const imported = makeImage({});
		const moderated = makeImage({
			source: "community-reviewed",
			sourceReference: "approved/00021130493609/front.jpg",
			imageUrl: "https://example.com/approved/front.jpg",
			confidence: "moderator-reviewed",
		});
		const client = makeImageQueryClient([
			makeImageRow(imported),
			makeImageRow(moderated),
		]);

		await expect(
			getCachedFoodImageByBarcode(client, "021130493609"),
		).resolves.toMatchObject({
			imageUrl: moderated.imageUrl,
			confidence: "moderator-reviewed",
		});
	});

	it("replaces a saved snapshot image with the preferred database image", async () => {
		const imported = makeImage({});
		const moderated = makeImage({
			source: "community-reviewed",
			sourceReference: "approved/00021130493609/front.jpg",
			imageUrl: "https://example.com/approved/front.jpg",
			confidence: "moderator-reviewed",
		});
		const client = makeImageQueryClient([makeImageRow(moderated)]);
		const food = {
			fdcId: 1,
			description: "Roasted Onion & Garlic Pasta Sauce",
			foodNutrients: [],
			barcode: "00021130493609",
			image: imported,
		} satisfies FdcFood;

		const [hydrated] = await hydrateFoodsWithCachedImages(client, [food]);

		expect(hydrated.image).toMatchObject({
			imageUrl: moderated.imageUrl,
			confidence: "moderator-reviewed",
		});
	});
});
