import { describe, expect, it } from "vitest";
import {
	associateCatalogImagesWithProducts,
	removeHeldImagesFromPublicCatalog,
} from "$lib/server/products/catalogRead.server";

const product = {
	id: "8dd47c75-17f7-4458-bb24-63cff946a716",
	barcode: "00021130493609",
};

const createImage = (
	id: string,
	sharedProductId: string | null,
	imageUrl: string,
) => ({
	id,
	barcode: product.barcode,
	shared_product_id: sharedProductId,
	source: "open-food-facts",
	source_reference: product.barcode,
	image_role: "front",
	image_url: imageUrl,
	thumbnail_url: null,
	license_name: "CC BY-SA 3.0",
	license_url: "https://creativecommons.org/licenses/by-sa/3.0/",
	attribution_text: "Open Food Facts contributors",
	confidence: "source-verified",
	crop_x: 50,
	crop_y: 50,
	crop_zoom: 1,
	rotation_degrees: 0,
	fit_mode: "contain",
	placement_version: 2,
	crop_source: null,
	placement_method: null,
	placement_suggestion_version: null,
	placement_suggestion_confidence: null,
	placement_suggestion_accepted_at: null,
	approved_at: null,
	fetched_at: "2026-08-11T12:00:00.000Z",
});

describe("catalog image publication association", () => {
	it("publishes only images explicitly linked to the canonical product", () => {
		const images = associateCatalogImagesWithProducts(
			[product as never],
			[
				createImage(
					"11111111-1111-4111-8111-111111111111",
					product.id,
					"https://images.example/canonical.jpg",
				),
				createImage(
					"22222222-2222-4222-8222-222222222222",
					null,
					"https://images.example/barcode-only.jpg",
				),
			] as never,
			"canonical-product-only",
		);

		expect(images.get(product.id)?.map((image) => image.imageUrl)).toEqual([
			"https://images.example/canonical.jpg",
		]);
	});

	it("retains barcode fallbacks for non-public app views", () => {
		const images = associateCatalogImagesWithProducts(
			[product as never],
			[
				createImage(
					"22222222-2222-4222-8222-222222222222",
					null,
					"https://images.example/barcode-only.jpg",
				),
			] as never,
			"canonical-and-barcode-fallback",
		);

		expect(images.get(product.id)?.map((image) => image.imageUrl)).toEqual([
			"https://images.example/barcode-only.jpg",
		]);
	});

	it("removes only actively held images from public API hydration", () => {
		const publishedImage = createImage(
			"11111111-1111-4111-8111-111111111111",
			product.id,
			"https://images.example/published.jpg",
		);
		const heldImage = createImage(
			"22222222-2222-4222-8222-222222222222",
			product.id,
			"https://images.example/held.jpg",
		);
		const images = new Map([
			[publishedImage.id, publishedImage],
			[heldImage.id, heldImage],
		]);

		removeHeldImagesFromPublicCatalog(images as never, [heldImage.id, null]);

		expect([...images.values()].map((image) => image.image_url)).toEqual([
			"https://images.example/published.jpg",
		]);
	});
});
