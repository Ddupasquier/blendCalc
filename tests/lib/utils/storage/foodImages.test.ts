import { describe, expect, it } from "vitest";
import {
	getCachedFoodImageByBarcode,
	hydrateFoodsWithCachedImages,
	selectPreferredFoodImageAsset,
} from "$lib/utils/storage/supabase/foodImages";
import type { FoodItem, FoodImageAsset } from "$lib/utils/food/types";

const makeImage = (overrides: Partial<FoodImageAsset>): FoodImageAsset => ({
	source: "open-food-facts",
	sourceReference: "00021130493609",
	role: "front",
	imageUrl: "https://example.com/front.jpg",
	licenseName: "Example license",
	confidence: "imported",
	fetchedAt: "2026-07-18T12:00:00.000Z",
	...overrides,
});

const makeImageRow = (
	image: FoodImageAsset,
	identity: {
		barcode?: string | null;
		sharedProductId?: string | null;
	} = {},
) => ({
	barcode: identity.barcode === undefined ? "00021130493609" : identity.barcode,
	shared_product_id: identity.sharedProductId ?? null,
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
	canonical_status: image.canonicalStatus ?? "candidate",
	canonical_selection_method: image.canonicalSelectionMethod ?? null,
	canonical_selected_at: image.canonicalSelectedAt ?? null,
	crop_x: image.cropX ?? 50,
	crop_y: image.cropY ?? 50,
	crop_zoom: image.cropZoom ?? 1,
	rotation_degrees: image.rotationDegrees ?? 0,
	fit_mode: image.fitMode ?? "contain",
	placement_version: image.placementVersion ?? 2,
	crop_source: image.cropSource ?? "auto",
	placement_method: image.placementMethod ?? "default",
	placement_suggestion_version: image.suggestionVersion ?? null,
	placement_suggestion_confidence: image.suggestionConfidence ?? null,
	placement_suggestion_accepted_at: image.suggestionAcceptedAt ?? null,
	approved_by: image.approvedBy ?? null,
	approved_at: image.approvedAt ?? null,
	fetched_at: image.fetchedAt ?? "2026-07-18T12:00:00.000Z",
});

const makeImageQueryClient = (rows: ReturnType<typeof makeImageRow>[]) => ({
	from: () => ({
		select: () => ({
			eq: () => ({
				eq: () => ({
					in: (column: "barcode" | "shared_product_id", values: string[]) => ({
						order: async () => ({
							data: rows.filter((row) => {
								const value = row[column];
								return value !== null && values.includes(value);
							}),
							error: null,
						}),
					}),
				}),
			}),
		}),
	}),
});

describe("food image selection", () => {
	it("keeps the canonical image ahead of a newer higher-confidence candidate", () => {
		const canonical = makeImage({
			canonicalStatus: "selected",
			canonicalSelectionMethod: "exact-licensed-source",
			canonicalSelectedAt: "2026-07-17T12:00:00.000Z",
			fetchedAt: "2026-07-17T12:00:00.000Z",
		});
		const newerCandidate = makeImage({
			source: "community-reviewed",
			sourceReference: "approved/00021130493609/front.jpg",
			confidence: "moderator-reviewed",
			fetchedAt: "2026-07-18T12:00:00.000Z",
		});

		expect(selectPreferredFoodImageAsset([newerCandidate, canonical])).toBe(
			canonical,
		);
	});

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
			fitMode: "contain",
			rotationDegrees: 0,
			placementVersion: 2,
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
		} satisfies FoodItem;

		const [hydrated] = await hydrateFoodsWithCachedImages(client, [food]);

		expect(hydrated.image).toMatchObject({
			imageUrl: moderated.imageUrl,
			confidence: "moderator-reviewed",
		});
	});

	it("chooses the best image across barcode and shared-product identities", async () => {
		const imported = makeImage({
			imageUrl: "https://example.com/imported/front.jpg",
			cropX: 15,
		});
		const moderated = makeImage({
			source: "community-reviewed",
			sourceReference: "approved/product-1/front.jpg",
			imageUrl: "https://example.com/approved/front.jpg",
			confidence: "moderator-reviewed",
			cropX: 32,
			cropY: 44,
			cropZoom: 2.25,
			rotationDegrees: 90,
			fitMode: "cover",
			placementVersion: 2,
		});
		const client = makeImageQueryClient([
			makeImageRow(imported),
			makeImageRow(moderated, {
				barcode: null,
				sharedProductId: "product-1",
			}),
		]);
		const food = {
			fdcId: 1,
			description: "Pork Chorizo, Pork",
			foodNutrients: [],
			barcode: "00021130493609",
			sharedProductId: "product-1",
			image: imported,
		} satisfies FoodItem;

		const [hydrated] = await hydrateFoodsWithCachedImages(client, [food]);

		expect(hydrated.image).toMatchObject({
			imageUrl: moderated.imageUrl,
			confidence: "moderator-reviewed",
			cropX: 32,
			cropY: 44,
			cropZoom: 2.25,
			rotationDegrees: 90,
			fitMode: "cover",
			placementVersion: 2,
		});
	});
});
