import {
	expect,
	signInLocalQaAccount,
	test,
	waitForAppReady,
} from "./support/browserTest";
import { createLocalQaServiceRoleDatabaseClient } from "./support/localQaDatabase";
import { createLocalQaCatalogReviewer } from "./support/localQaCatalogReviewer";
import { finishLocalQaAuthenticatorEnrollment } from "./support/localQaAuthenticator";
import { serveDeterministicOpenFoodFactsImages } from "./support/deterministicProviderImages";
import type { FoodImageAsset } from "$lib/utils/food/types";
import type { Database } from "$lib/types/database.types";

test("@compatibility @mobile personal image placement stays private and shared suggestions get a moderator decision", async ({
	page,
}, testInfo) => {
	const admin = await createLocalQaServiceRoleDatabaseClient();
	const reviewer = await createLocalQaCatalogReviewer();
	const foodId = 2032704;
	const nutritionPath = `/ingredients/fridge/nutrition/${foodId}`;
	const startedAt = new Date().toISOString();
	let imageId: string | undefined;
	let original:
		Database["public"]["Tables"]["food_image_assets"]["Row"] | null = null;
	let ownerId: string | undefined;
	const cleanupPlacement = async () => {
		try {
			if (imageId && ownerId) {
				const removedPreference = await admin
					.from("food_image_placement_preferences")
					.delete()
					.eq("image_id", imageId)
					.eq("user_id", ownerId);
				const removedSuggestion = await admin
					.from("food_image_placement_suggestions")
					.delete()
					.eq("image_id", imageId)
					.eq("user_id", ownerId)
					.gte("created_at", startedAt);
				if (removedPreference.error || removedSuggestion.error)
					throw new Error("Could not restore owned placement fixture rows.");
			}
			if (imageId && original) {
				const restored = await admin
					.from("food_image_assets")
					.update({
						crop_x: original.crop_x,
						crop_y: original.crop_y,
						crop_zoom: original.crop_zoom,
						rotation_degrees: original.rotation_degrees,
						fit_mode: original.fit_mode,
						placement_version: original.placement_version,
						crop_source: original.crop_source,
						placement_method: original.placement_method,
						placement_suggestion_version: original.placement_suggestion_version,
						placement_suggestion_confidence:
							original.placement_suggestion_confidence,
						placement_suggestion_accepted_at:
							original.placement_suggestion_accepted_at,
						approved_by: original.approved_by,
						approved_at: original.approved_at,
						community_placement_locked: original.community_placement_locked,
						community_placement_anchor: original.community_placement_anchor,
					})
					.eq("id", imageId);
				if (restored.error)
					throw new Error("Could not restore the shared image fixture.");
			}
		} finally {
			await reviewer.cleanup();
		}
	};

	try {
		await serveDeterministicOpenFoodFactsImages(page);
		await page.goto(nutritionPath);
		await waitForAppReady(page);
		const image = (await page.evaluate(async (id) => {
			const response = await fetch(
				"/api/user-food-lists/fridge?limit=100&offset=0&sort=recent&source=all&trust=any",
			);
			if (!response.ok)
				throw new Error("Could not read the local image fixture.");
			const data = await response.json();
			return data.foods.find((food: { fdcId: number }) => food.fdcId === id)
				?.image;
		}, foodId)) as FoodImageAsset;
		expect(image.assetId).toBeTruthy();
		imageId = image.assetId;
		const asset = await admin
			.from("food_image_assets")
			.select("*")
			.eq("id", imageId!)
			.single();
		if (asset.error || !asset.data)
			throw new Error("Could not read the owned image fixture.");
		original = asset.data;
		const details = page.locator(".nutrition-detail-view");
		await details
			.getByText("Adjust card image placement", { exact: true })
			.click();
		const editor = details.getByRole("region", {
			name: "Card image placement",
		});
		await editor
			.getByRole("slider", { name: "Image zoom" })
			.evaluate((element) => {
				(element as HTMLInputElement).value = "1.65";
				element.dispatchEvent(new Event("input", { bubbles: true }));
			});
		const save = details.getByRole("button", {
			name: "Save",
			exact: true,
		});
		await save.focus();
		await save.press("Enter");
		await expect(details.getByText("Saved.")).toBeVisible();
		const unchanged = await admin
			.from("food_image_assets")
			.select("crop_zoom,placement_revision")
			.eq("id", imageId!)
			.single();
		expect(unchanged.data).toMatchObject({
			crop_zoom: original.crop_zoom,
			placement_revision: original.placement_revision,
		});
		const preference = await admin
			.from("food_image_placement_preferences")
			.select("user_id")
			.eq("image_id", imageId!)
			.order("updated_at", { ascending: false })
			.limit(1)
			.single();
		if (preference.error || !preference.data)
			throw new Error("Personal placement was not persisted.");
		ownerId = preference.data.user_id;
		await page.reload();
		await waitForAppReady(page);
		await details
			.getByText("Adjust card image placement", { exact: true })
			.click();
		await expect(
			editor.getByRole("slider", { name: "Image zoom" }),
		).toHaveValue("1.65");
		for (const [width, theme] of [
			[390, "light"],
			[390, "dark"],
			[1280, "light"],
		] as const) {
			await page.setViewportSize({ width, height: 900 });
			await page.locator("html").evaluate((element, value) => {
				element.dataset.theme = value;
			}, theme);
			await expect(save).toBeVisible();
			await save.scrollIntoViewIfNeeded();
			expect(
				await page.evaluate(
					() => document.documentElement.scrollWidth <= innerWidth,
				),
			).toBe(true);
			await page.screenshot({
				path: `test-results/DEV-130-002/personal-${testInfo.project.name}-${width}-${theme}.png`,
				fullPage: true,
			});
		}
		await details
			.getByRole("button", { name: "Reset to shared image" })
			.click();
		await expect(details.getByText("Reset to the shared image.")).toBeVisible();
		const resetPreference = await admin
			.from("food_image_placement_preferences")
			.select("image_id")
			.eq("image_id", imageId!)
			.eq("user_id", ownerId);
		expect(resetPreference.data).toEqual([]);
		await editor
			.getByRole("slider", { name: "Image zoom" })
			.evaluate((element) => {
				(element as HTMLInputElement).value = "1.7";
				element.dispatchEvent(new Event("input", { bubbles: true }));
			});
		await details
			.getByRole("checkbox", { name: "Suggest this adjustment for everyone" })
			.check();
		await save.click();
		await expect(
			details.getByText("Saved. Thanks for suggesting an improvement.", {
				exact: true,
			}),
		).toBeVisible();
		await signInLocalQaAccount({
			page,
			email: reviewer.email,
			nextPath: "/ingredients/fridge",
		});
		await page.goto(
			`/profile/privileged-tools/image-placement?image=${imageId}`,
		);
		await waitForAppReady(page);
		if (new URL(page.url()).pathname === "/auth/mfa/enroll")
			await finishLocalQaAuthenticatorEnrollment(page);
		await expect(page).toHaveURL(
			/\/profile\/privileged-tools\/image-placement/,
		);
		const review = page.getByRole("region", { name: /Placement review for/ });
		await expect(
			review.getByText("1 contributor suggests this placement"),
		).toBeVisible();
		for (const width of [390, 1280]) {
			await page.setViewportSize({ width, height: 900 });
			await review
				.getByRole("button", { name: "Approve for everyone" })
				.scrollIntoViewIfNeeded();
			await expect
				.poll(() =>
					review
						.getByRole("region", { name: "Grouped placement suggestion" })
						.locator("img")
						.evaluate(
							(image) =>
								image instanceof HTMLImageElement &&
								image.complete &&
								image.naturalWidth > 0,
						),
				)
				.toBe(true);
			expect(
				await page.evaluate(
					() => document.documentElement.scrollWidth <= innerWidth,
				),
			).toBe(true);
			await page.screenshot({
				path: `test-results/DEV-130-002/review-${testInfo.project.name}-${width}.png`,
				fullPage: true,
			});
		}
		await review.getByRole("button", { name: "Approve for everyone" }).click();
		await expect(
			page.getByText("Image-placement review saved.", { exact: true }),
		).toBeVisible();
		await expect(
			review.getByText("Locked against community changes.", { exact: false }),
		).toBeVisible();
		await review.getByText("Placement history", { exact: true }).click();
		const undoComplete = page.waitForResponse(
			(response) =>
				response.request().method() === "POST" &&
				response.url().includes("/image-placement"),
		);
		await review
			.getByRole("button", { name: "Restore previous placement and lock" })
			.click();
		await undoComplete;
		const restored = await admin
			.from("food_image_assets")
			.select("crop_zoom,community_placement_locked,placement_revision")
			.eq("id", imageId!)
			.single();
		expect(restored.data).toMatchObject({
			crop_zoom: original.crop_zoom,
			community_placement_locked: true,
		});
		await expect(
			review.getByText(`Image revision ${restored.data!.placement_revision}.`, {
				exact: false,
			}),
		).toBeVisible();
		await review.getByText("Adjust shared image", { exact: true }).click();
		const sharedEditor = review.getByRole("region", {
			name: "Shared image adjustment",
			exact: true,
		});
		await expect(
			sharedEditor.getByRole("slider", { name: "Image zoom" }),
		).toBeEnabled();
		await sharedEditor
			.getByRole("slider", { name: "Image zoom" })
			.evaluate((element) => {
				(element as HTMLInputElement).value = "1.8";
				element.dispatchEvent(new Event("input", { bubbles: true }));
			});
		await sharedEditor
			.getByRole("button", { name: "Publish shared placement", exact: true })
			.click();
		await expect(
			page.getByText("Shared image updated.", { exact: true }),
		).toBeVisible();
		const published = await admin
			.from("food_image_assets")
			.select("crop_zoom,community_placement_locked")
			.eq("id", imageId!)
			.single();
		expect(published.data).toMatchObject({
			crop_zoom: 1.8,
			community_placement_locked: true,
		});
		await page.setViewportSize({ width: 390, height: 844 });
		await sharedEditor
			.getByRole("button", { name: "Publish shared placement", exact: true })
			.scrollIntoViewIfNeeded();
		await page.screenshot({
			path: `test-results/DEV-130-002/shared-editor-${testInfo.project.name}.png`,
			fullPage: true,
		});
	} finally {
		await cleanupPlacement();
	}
});
