import {
	clearLoadedSavedRecipe,
	readLoadedSavedRecipe,
	saveExistingSavedRecipe,
	saveNewSavedRecipe,
	writeLoadedSavedRecipe,
	type LoadedSavedRecipe,
	type SavedRecipeInput,
} from "$lib/utils/storage/client/savedRecipes";

type SavedRecipeControllerOptions = {
	buildSavedRecipeInput: (name: string) => SavedRecipeInput;
	onRecipeSaved: () => void;
};

const getSaveErrorMessage = (
	reason: "duplicate" | "missing" | "unavailable",
) => {
	if (reason === "duplicate") {
		return "You already have a saved recipe with this name. Choose a different name.";
	}
	if (reason === "missing") {
		return "This saved recipe no longer exists. Save it as a new recipe instead.";
	}
	return "Your recipe could not be saved right now. Check your connection and try again.";
};

export const createSavedRecipeController = ({
	buildSavedRecipeInput,
	onRecipeSaved,
}: SavedRecipeControllerOptions) => {
	const state = $state({
		loaded: null as LoadedSavedRecipe | null,
		error: "",
		busy: false,
	});

	const setLoadedRecipe = (loadedRecipe: LoadedSavedRecipe | null) => {
		state.loaded = loadedRecipe;
		if (loadedRecipe) {
			writeLoadedSavedRecipe(loadedRecipe);
			return;
		}
		clearLoadedSavedRecipe();
	};

	const restore = () => {
		state.loaded = readLoadedSavedRecipe();
	};

	const markDirty = () => {
		if (!state.loaded || state.loaded.isDirty) return;
		setLoadedRecipe({ ...state.loaded, isDirty: true });
	};

	const clearError = () => {
		state.error = "";
	};

	const validateName = (name: string) => {
		if (name.trim()) return true;
		state.error = "Give this recipe a name first.";
		return false;
	};

	const saveAsNew = async (name: string) => {
		if (!validateName(name)) return;
		state.busy = true;
		state.error = "";
		const result = await saveNewSavedRecipe(buildSavedRecipeInput(name));
		state.busy = false;
		if (!result.ok) {
			state.error = getSaveErrorMessage(result.reason);
			return;
		}
		setLoadedRecipe({ id: result.recipe.id, name: result.recipe.name, isDirty: false });
		onRecipeSaved();
	};

	const overwrite = async (name: string) => {
		if (!state.loaded || !validateName(name)) return;
		state.busy = true;
		state.error = "";
		const result = await saveExistingSavedRecipe(
			state.loaded.id,
			buildSavedRecipeInput(name),
		);
		state.busy = false;
		if (!result.ok) {
			state.error = getSaveErrorMessage(result.reason);
			return;
		}
		setLoadedRecipe({ id: result.recipe.id, name: result.recipe.name, isDirty: false });
		onRecipeSaved();
	};

	return {
		state,
		restore,
		markDirty,
		detach: () => setLoadedRecipe(null),
		clearError,
		saveAsNew,
		overwrite,
	};
};

export type SavedRecipeController = ReturnType<typeof createSavedRecipeController>;
