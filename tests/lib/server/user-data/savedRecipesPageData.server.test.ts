import { beforeEach, describe, expect, it, vi } from "vitest";

const cloudStorage = vi.hoisted(() => ({
	readCloudSavedRecipes: vi.fn(),
}));

vi.mock("$lib/utils/storage/supabase", () => cloudStorage);

import { loadSavedRecipesPageData } from "$lib/server/user-data/savedRecipesPageData.server";

const cloudDataContext = {
	supabase: {} as never,
	userId: "user-1",
};

describe("loadSavedRecipesPageData", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		cloudStorage.readCloudSavedRecipes.mockResolvedValue([{ id: "recipe-1" }]);
	});

	it("loads saved recipes before rendering the Saved page", async () => {
		const result = await loadSavedRecipesPageData(cloudDataContext);

		expect(result.recipes).toEqual([{ id: "recipe-1" }]);
		expect(result.loadError).toBe("");
	});

	it("returns an honest empty state when saved recipes are unavailable", async () => {
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		cloudStorage.readCloudSavedRecipes.mockRejectedValueOnce(new Error("offline"));

		await expect(loadSavedRecipesPageData(cloudDataContext)).resolves.toEqual({
			recipes: [],
			loadError: "Your saved recipes could not be loaded. Try again.",
		});
	});
});
