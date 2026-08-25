import type { FoodItem } from "$lib/utils/food/types";
import type { ManualEntryCreateHandler } from "$lib/components/ingredients/manual-entry/types";
import {
	addManualEntryFoodToDestination,
	getDestinationLabel,
	type ManualEntryDestinationResult,
} from "$lib/components/ingredients/manual-entry/utils/listOutcome";
import type { ManualEntryListMovePromptState } from "$lib/components/ingredients/manual-entry/formTypes";
import { getInitialSaveDestination } from "$lib/components/ingredients/manual-entry/utils/formState";

type ManualEntryOutcomeControllerOptions = {
	onCreate: ManualEntryCreateHandler;
	onError: (message: string) => void;
};

export const createManualEntryOutcomeController = ({
	onCreate,
	onError,
}: ManualEntryOutcomeControllerOptions) => {
	const state = $state({
		saveDestination: getInitialSaveDestination(),
		listMovePrompt: null as ManualEntryListMovePromptState | null,
		placementMessage: "",
	});

	const applyDestinationResult = (result: ManualEntryDestinationResult) => {
		if (!result.ok) {
			if (!result.moveRequired) onError(result.error);
			return false;
		}
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
			state.placementMessage = `${currentPrompt.food.description} remains in ${getDestinationLabel(currentPrompt.source)}.`;
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
		return true;
	};

	const resetBeforeSubmit = () => {
		state.placementMessage = "";
	};

	const destroy = () => {
		state.listMovePrompt?.resolve(false);
		state.listMovePrompt = null;
	};

	return {
		state,
		useIngredient,
		resolveListMovePrompt,
		resetBeforeSubmit,
		destroy,
	};
};

export type ManualEntryOutcomeController = ReturnType<
	typeof createManualEntryOutcomeController
>;
