import { describe, expect, it } from "vitest";
import { createStorageAssetInventory } from "../../scripts/lib/rehearsal/source_assets.mjs";

const sourceOwner = "11111111-1111-4111-8111-111111111111";
const personaOwner = "22222222-2222-4222-8222-222222222222";

describe("Rehearsal source Storage inventory", () => {
	it("includes public product images and only the approved owner's private assets", () => {
		const inventory = createStorageAssetInventory({
			ownerSourceUserId: sourceOwner,
			ownerPersonaUserId: personaOwner,
		});
		inventory.observe({
			table: "food_image_assets",
			row: { storage_path: "000123/product/front.webp" },
		});
		inventory.observe(
			{
				table: "profiles",
				row: { avatar_path: `${sourceOwner}/avatar.webp` },
			},
			{ ownerRow: true },
		);
		inventory.observe(
			{
				table: "shared_product_submissions",
				row: {
					evidence_paths: {
						front: `${sourceOwner}/submission/front.webp`,
						nutrition: `${sourceOwner}/submission/nutrition.webp`,
					},
				},
			},
			{ ownerRow: true },
		);

		expect(inventory.values()).toEqual([
			{
				bucket: "food-image-assets",
				sourcePath: "000123/product/front.webp",
				objectPath: "000123/product/front.webp",
			},
			{
				bucket: "profile-avatars",
				sourcePath: `${sourceOwner}/avatar.webp`,
				objectPath: `${personaOwner}/avatar.webp`,
			},
			{
				bucket: "product-submission-evidence",
				sourcePath: `${sourceOwner}/submission/front.webp`,
				objectPath: `${personaOwner}/submission/front.webp`,
			},
			{
				bucket: "product-submission-evidence",
				sourcePath: `${sourceOwner}/submission/nutrition.webp`,
				objectPath: `${personaOwner}/submission/nutrition.webp`,
			},
		]);
	});

	it("fails closed if an owner asset escapes the approved prefix", () => {
		const inventory = createStorageAssetInventory({
			ownerSourceUserId: sourceOwner,
			ownerPersonaUserId: personaOwner,
		});
		expect(() =>
			inventory.observe(
				{
					table: "profiles",
					row: { avatar_path: "another-user/avatar.webp" },
				},
				{ ownerRow: true },
			),
		).toThrow("escaped the approved source prefix");
	});
});
