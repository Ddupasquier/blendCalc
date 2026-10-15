import { randomUUID } from "node:crypto";
import { expect, test, waitForAppReady } from "./support/browserTest";
import {
	getAuthenticatedLocalQaDatabaseClient,
	readLocalQaSavedRecipesByNamePrefix,
} from "./support/localQaDatabase";
import type { Json } from "$lib/types/database.types";
import type { SavedRecipe } from "$lib/utils/storage/client/savedRecipes";

for (const transport of ["clipboard", "share"] as const) {
	test(
		`saved recipe ${transport} distinguishes complete, partial, missing and zero nutrition`,
		{ tag: ["@compatibility", "@mobile"] },
		async ({ page }, testInfo) => {
			const client = await getAuthenticatedLocalQaDatabaseClient(
				testInfo.parallelIndex,
			);
			const [baseline] = await readLocalQaSavedRecipesByNamePrefix(
				testInfo.parallelIndex,
				"QA Export Berry Mix",
			);
			expect(baseline).toBeDefined();
			const ownedIds: string[] = [];
			let exportedText = "";
			await page.exposeFunction("captureRecipeExport", (text: string) => {
				exportedText = text;
			});
			await page.addInitScript((mode) => {
				const capture = (text: string) =>
					(
						window as unknown as {
							captureRecipeExport: (text: string) => Promise<void>;
						}
					).captureRecipeExport(text);
				Object.defineProperty(navigator, "share", {
					configurable: true,
					value:
						mode === "share"
							? async (data: { text: string }) => capture(data.text)
							: undefined,
				});
				Object.defineProperty(navigator, "clipboard", {
					configurable: true,
					value: { writeText: capture },
				});
			}, transport);
			try {
				for (const scenario of [
					"complete",
					"partial",
					"unknown",
					"zero",
				] as const) {
					const recipe = structuredClone(
						baseline.recipe,
					) as unknown as SavedRecipe;
					recipe.id = randomUUID();
					recipe.name = `QA Export ${scenario} ${recipe.id.slice(0, 8)}`;
					recipe.createdAt = Date.now();
					recipe.foods = recipe.foods.slice(0, 2).map((food, index) => ({
						...food,
						foodNutrients:
							scenario === "unknown" || (scenario === "partial" && index === 1)
								? []
								: [
										{
											nutrientId: 1003,
											nutrientName: "Protein",
											nutrientNumber: "203",
											unitName: "G",
											value: scenario === "zero" || index === 1 ? 0 : 10,
											valueStatus: "reported" as const,
										},
									],
					}));
					recipe.selected = [1003];
					recipe.options = [{ id: 1003, label: "Protein" }];
					recipe.nutrientGoals = { 1003: recipe.nutrientGoals[1003] };
					recipe.servingGrams = Object.fromEntries(
						recipe.foods.map((food) => [food.fdcId, 100]),
					);
					recipe.servingQuantities = { ...recipe.servingGrams };
					recipe.servingUnits = Object.fromEntries(
						recipe.foods.map((food) => [food.fdcId, "g"]),
					);
					const { data, error } = await client.rpc("save_saved_drink", {
						p_id: recipe.id,
						p_name: recipe.name,
						p_created_at: new Date(recipe.createdAt).toISOString(),
						p_drink: recipe as unknown as Json,
					});
					expect(error).toBeNull();
					expect(data).toBe("saved");
					ownedIds.push(recipe.id);
					const before = await readLocalQaSavedRecipesByNamePrefix(
						testInfo.parallelIndex,
						recipe.name,
					);
					await page.goto("/saved");
					await waitForAppReady(page);
					await page
						.getByRole("searchbox", {
							name: "Search saved recipes by name or ingredient",
						})
						.fill(recipe.name);
					const card = page
						.locator(".saved-recipe-card")
						.filter({ has: page.getByText(recipe.name, { exact: true }) });
					const summary = card.locator("summary").first();
					if (testInfo.project.use.hasTouch) await summary.tap();
					else await summary.click();
					await expect(card.locator("details").first()).toHaveAttribute(
						"open",
						"",
					);
					// Export assertions start after disclosure motion; touch projects
					// exercise the same input a phone user actually uses.
					await card.evaluate(async (element) => {
						await Promise.all(
							element
								.getAnimations({ subtree: true })
								.map((animation) => animation.finished.catch(() => undefined)),
						);
					});
					const share = card.getByRole("button", {
						name: "Share recipe",
						exact: true,
					});
					if (testInfo.project.use.hasTouch) await share.tap();
					else await share.click();
					await expect(
						card.getByText(
							transport === "clipboard"
								? "Recipe copied to your clipboard."
								: "Recipe shared.",
							{ exact: true },
						),
					).toBeVisible();
					expect(exportedText).toContain(recipe.name);
					expect(exportedText).toContain("Ingredients\n- 100 g");
					expect(exportedText).toContain("Created with blendCalc");
					const expected =
						scenario === "partial"
							? "Protein: 10 g known; total incomplete (1 of 2 ingredients)"
							: scenario === "unknown"
								? "Protein: Unknown (no calculable nutrient data)"
								: scenario === "zero"
									? "Protein: 0 g"
									: "Protein: 10 g";
					expect(exportedText).toContain(expected);
					expect(exportedText.includes("Nutrition is incomplete")).toBe(
						scenario === "partial" || scenario === "unknown",
					);
					expect(
						await readLocalQaSavedRecipesByNamePrefix(
							testInfo.parallelIndex,
							recipe.name,
						),
					).toEqual(before);
					expect(
						await page.evaluate(
							() => document.documentElement.scrollWidth <= window.innerWidth,
						),
					).toBe(true);
				}
			} finally {
				for (const id of ownedIds) {
					const { data, error } = await client.rpc("delete_saved_drink", {
						p_id: id,
					});
					expect(error).toBeNull();
					expect(data).toBe(true);
				}
			}
		},
	);
}

test("saved recipe fallback writes readable text to the real Chromium clipboard", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "desktop-chromium",
		"Native clipboard permissions are covered in desktop Chromium.",
	);
	await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
	await page.addInitScript(() =>
		Object.defineProperty(navigator, "share", {
			configurable: true,
			value: undefined,
		}),
	);
	await page.goto("/saved");
	await waitForAppReady(page);
	await page
		.getByRole("searchbox", {
			name: "Search saved recipes by name or ingredient",
		})
		.fill("QA Export Berry Mix");
	const card = page
		.locator(".saved-recipe-card")
		.filter({ has: page.getByText("QA Export Berry Mix", { exact: true }) });
	await card.locator("summary").first().click();
	await card.getByRole("button", { name: "Share recipe", exact: true }).click();
	await expect(
		card.getByText("Recipe copied to your clipboard.", { exact: true }),
	).toBeVisible();
	const text = await page.evaluate(() => navigator.clipboard.readText());
	expect(text).toContain("QA Export Berry Mix\n\nIngredients\n");
	expect(text).toContain("- 100 g");
	expect(text).toContain("- 170 g");
	expect(text).toContain("\n\nNutrition totals\n");
	expect(text).toContain("Created with blendCalc");
});
