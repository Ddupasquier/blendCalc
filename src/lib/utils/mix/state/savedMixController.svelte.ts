import {
	clearLoadedSavedRecipe,
	readLoadedSavedRecipe,
	saveExistingSavedRecipe,
	saveNewSavedRecipe,
	writeLoadedSavedRecipe,
	type LoadedSavedRecipe,
	type SavedRecipeInput,
} from "$lib/utils/storage/client/savedRecipes";

type SavedMixControllerOptions = {
	buildInput: (name: string) => SavedRecipeInput;
	onSaved: () => void;
};

const getSaveErrorMessage = (
	reason: "duplicate" | "missing" | "unavailable",
) => {
	if (reason === "duplicate") {
		return "You already have a saved Mix with this name. Choose a different name.";
	}
	if (reason === "missing") {
		return "This saved Mix no longer exists. Save it as a new Mix instead.";
	}
	return "Your Mix could not be saved right now. Check your connection and try again.";
};

export const createSavedMixController = ({
	buildInput,
	onSaved,
}: SavedMixControllerOptions) => {
	const state = $state({
		loaded: null as LoadedSavedRecipe | null,
		error: "",
		busy: false,
	});

	const setLoaded = (mix: LoadedSavedRecipe | null) => {
		state.loaded = mix;
		if (mix) {
			writeLoadedSavedRecipe(mix);
			return;
		}
		clearLoadedSavedRecipe();
	};

	const restore = () => {
		state.loaded = readLoadedSavedRecipe();
	};

	const markDirty = () => {
		if (!state.loaded || state.loaded.isDirty) return;
		setLoaded({ ...state.loaded, isDirty: true });
	};

	const clearError = () => {
		state.error = "";
	};

	const validateName = (name: string) => {
		if (name.trim()) return true;
		state.error = "Give this Mix a name first.";
		return false;
	};

	const saveAsNew = async (name: string) => {
		if (!validateName(name)) return;
		state.busy = true;
		state.error = "";
		const result = await saveNewSavedRecipe(buildInput(name));
		state.busy = false;
		if (!result.ok) {
			state.error = getSaveErrorMessage(result.reason);
			return;
		}
		setLoaded({ id: result.recipe.id, name: result.recipe.name, isDirty: false });
		onSaved();
	};

	const overwrite = async (name: string) => {
		if (!state.loaded || !validateName(name)) return;
		state.busy = true;
		state.error = "";
		const result = await saveExistingSavedRecipe(
			state.loaded.id,
			buildInput(name),
		);
		state.busy = false;
		if (!result.ok) {
			state.error = getSaveErrorMessage(result.reason);
			return;
		}
		setLoaded({ id: result.recipe.id, name: result.recipe.name, isDirty: false });
		onSaved();
	};

	return {
		state,
		restore,
		markDirty,
		detach: () => setLoaded(null),
		clearError,
		saveAsNew,
		overwrite,
	};
};

export type SavedMixController = ReturnType<typeof createSavedMixController>;
