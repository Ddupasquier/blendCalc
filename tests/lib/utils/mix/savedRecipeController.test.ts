import { beforeEach, describe, expect, it, vi } from "vitest";

const savedRecipeStorage = vi.hoisted(() => ({
	clearLoadedSavedRecipe: vi.fn(),
	readLoadedSavedRecipe: vi.fn(),
	saveExistingSavedRecipe: vi.fn(),
	saveNewSavedRecipe: vi.fn(),
	writeLoadedSavedRecipe: vi.fn(),
}));

vi.mock("$lib/utils/storage/client/savedRecipes", () => savedRecipeStorage);

import { createSavedRecipeController } from "$lib/utils/mix/state/savedRecipeController.svelte";

const createDeferredRecipeResult = () => {
	let resolve!: (result: {
		ok: true;
		recipe: { id: string; name: string };
	}) => void;
	const promise = new Promise<{
		ok: true;
		recipe: { id: string; name: string };
	}>((resolvePromise) => {
		resolve = resolvePromise;
	});
	return { promise, resolve };
};

const createController = () =>
	createSavedRecipeController({
		buildSavedRecipeInput: (name) => ({ name }) as never,
		onRecipeSaved: vi.fn(),
	});

describe("createSavedRecipeController", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		savedRecipeStorage.readLoadedSavedRecipe.mockReturnValue(null);
	});

	it("allows only one new-recipe save while a request is pending", async () => {
		const deferredResult = createDeferredRecipeResult();
		savedRecipeStorage.saveNewSavedRecipe.mockReturnValue(
			deferredResult.promise,
		);
		const controller = createController();

		const firstSave = controller.saveAsNew("Weekday lunch");
		const duplicateSave = controller.saveAsNew("Weekday lunch");

		expect(controller.state.busy).toBe(true);
		expect(savedRecipeStorage.saveNewSavedRecipe).toHaveBeenCalledOnce();
		deferredResult.resolve({
			ok: true,
			recipe: { id: "recipe-1", name: "Weekday lunch" },
		});
		await Promise.all([firstSave, duplicateSave]);

		expect(controller.state.busy).toBe(false);
		expect(controller.state.loaded).toEqual({
			id: "recipe-1",
			name: "Weekday lunch",
			isDirty: false,
		});
	});

	it("recovers from an unexpected overwrite failure", async () => {
		savedRecipeStorage.readLoadedSavedRecipe.mockReturnValue({
			id: "recipe-1",
			name: "Weekday lunch",
			isDirty: true,
		});
		savedRecipeStorage.saveExistingSavedRecipe.mockRejectedValue(
			new Error("offline"),
		);
		const controller = createController();
		controller.restore();

		await controller.overwrite("Weekday lunch");

		expect(controller.state.busy).toBe(false);
		expect(controller.state.error).toContain("could not be saved");
	});
});
