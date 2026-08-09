import type { FoodItem } from "$lib/utils/food/types";
import type { IngredientListKey } from "$lib/utils/storage/client/ingredientLists";
import type { ManualEntryCreateHandler } from "$lib/components/ingredients/manual-entry/types";
import {
	addManualEntryFoodToDestination,
	canChangeManualEntryOutcome,
	getDestinationLabel,
	runManualEntryOutcomeAction,
	type ManualEntryDestinationResult,
	type ManualEntryOutcomeAction,
} from "$lib/components/ingredients/manual-entry/utils/listOutcome";
import type {
	CustomIngredientOutcomeState,
	ManualEntryListMovePromptState,
} from "$lib/components/ingredients/manual-entry/formTypes";
import { getInitialSaveDestination } from "$lib/components/ingredients/manual-entry/utils/formState";
import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";

type ManualEntryOutcomeControllerOptions = {
	onCreate: ManualEntryCreateHandler;
	onCollapse: () => void;
	onError: (message: string) => void;
};

export const createManualEntryOutcomeController = ({
	onCreate,
	onCollapse,
	onError,
}: ManualEntryOutcomeControllerOptions) => {
	const state = $state({
		saveDestination: getInitialSaveDestination(),
		lastOutcome: null as CustomIngredientOutcomeState | null,
		listMovePrompt: null as ManualEntryListMovePromptState | null,
		outcomeAction: null as ManualEntryOutcomeAction | null,
		savedMessage: "",
	});

	const setOutcome = (
		food: FoodItem,
		destination: IngredientListKey,
		addedToList: boolean,
		message: string,
	) => {
		state.savedMessage = message;
		state.lastOutcome = {
			food,
			destination,
			addedToList,
			message,
		};
	};

	const applyDestinationResult = (result: ManualEntryDestinationResult) => {
		if (!result.ok) {
			if (!result.moveRequired) onError(result.error);
			return false;
		}

		setOutcome(
			result.food,
			result.destination,
			result.addedToList,
			result.message,
		);
		return true;
	};

	const requestListMoveConfirmation = (
		result: Extract<ManualEntryDestinationResult, { moveRequired: true }>,
	) =>
		new Promise<boolean>((resolve) => {
			state.listMovePrompt = {
				food: result.food,
				source: result.source,
				destination: result.destination,
				resolve,
			};
		});

	const resolveListMovePrompt = (confirmed: boolean) => {
		const currentPrompt = state.listMovePrompt;
		if (!currentPrompt) return;
		state.listMovePrompt = null;
		if (!confirmed) {
			state.savedMessage = `${currentPrompt.food.description} remains in ${getDestinationLabel(currentPrompt.source)}.`;
		}
		currentPrompt.resolve(confirmed);
	};

	const useIngredient = async (food: FoodItem, alreadySaved = false) => {
		let result = await addManualEntryFoodToDestination({
			food,
			saveDestination: state.saveDestination,
			alreadySaved,
			onCreate,
		});
		if (!result.ok && result.moveRequired) {
			const confirmed = await requestListMoveConfirmation(result);
			if (!confirmed) return false;
			result = await addManualEntryFoodToDestination({
				food,
				saveDestination: state.saveDestination,
				alreadySaved,
				onCreate,
				allowMove: true,
			});
		}
		if (!applyDestinationResult(result)) return false;
		onCollapse();
		return true;
	};

	const runLastOutcomeAction = async (
		action: ManualEntryOutcomeAction,
		destination?: IngredientListKey,
	) => {
		const currentOutcome = state.lastOutcome;
		if (
			!currentOutcome ||
			!canChangeManualEntryOutcome(currentOutcome, state.outcomeAction)
		) {
			return;
		}
		if (action === "move" && !destination) return;

		state.outcomeAction = action;
		onError("");
		try {
			if (action === "move") {
				if (!destination) return;
				const result = await runManualEntryOutcomeAction({
					action,
					lastOutcome: currentOutcome,
					destination,
				});
				applyDestinationResult(result);
				return;
			}

			const result = await runManualEntryOutcomeAction({
				action,
				lastOutcome: currentOutcome,
			});
			applyDestinationResult(result);
		} finally {
			state.outcomeAction = null;
		}
	};

	const moveLastOutcome = (destination: IngredientListKey) =>
		runLastOutcomeAction("move", destination);

	const resetBeforeSubmit = () => {
		state.savedMessage = "";
		state.lastOutcome = null;
	};

	const destroy = () => {
		state.listMovePrompt?.resolve(false);
		state.listMovePrompt = null;
	};

	return {
		state,
		useIngredient,
		resolveListMovePrompt,
		moveLastOutcome,
		moveLastOutcomeToShopping: () =>
			moveLastOutcome(MIX_STORAGE_KEYS.shoppingList),
		moveLastOutcomeToFridge: () =>
			moveLastOutcome(MIX_STORAGE_KEYS.fridge),
		undoLastOutcomeAdd: () => runLastOutcomeAction("undo"),
		resetBeforeSubmit,
		destroy,
	};
};

export type ManualEntryOutcomeController = ReturnType<
	typeof createManualEntryOutcomeController
>;
