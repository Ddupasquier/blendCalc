import type { CustomIngredientOutcomeState } from "$lib/components/ingredients/manual-entry/formTypes";
import type { ManualEntryCreateHandler } from "$lib/components/ingredients/manual-entry/types";
import type { FdcFood } from "$lib/utils/food/types";
import {
	addFoodToSmoothieList,
	removeFoodFromSmoothieList,
	type SmoothieListKey,
} from "$lib/utils/storage/client/smoothieLists";
import { MIX_STORAGE_KEYS } from "../../../../../defaults/mixDefaults";

export const getDestinationLabel = (
	destination: SmoothieListKey,
) => {
	if (destination === MIX_STORAGE_KEYS.fridge) return "Fridge";
	if (destination === MIX_STORAGE_KEYS.shoppingList) return "Shopping List";
	return "Selected list";
};

export const getListDestinationLabel = (destination: SmoothieListKey) =>
	destination === MIX_STORAGE_KEYS.fridge ? "Fridge" : "Shopping List";

export type ManualEntryDestinationResult =
	| {
			ok: true;
			food: FdcFood;
			destination: SmoothieListKey;
			addedToList: boolean;
			message: string;
		}
	| {
			ok: false;
			error: string;
		};

export type ManualEntryOutcomeAction = "move" | "undo";

export const canChangeManualEntryOutcome = (
	lastOutcome: CustomIngredientOutcomeState | null,
	outcomeAction: ManualEntryOutcomeAction | null,
) =>
	Boolean(
		lastOutcome &&
			lastOutcome.addedToList &&
			!outcomeAction,
	);

export const addManualEntryFoodToDestination = async ({
	food,
	saveDestination,
	alreadySaved,
	onCreate,
}: {
	food: FdcFood;
	saveDestination: SmoothieListKey;
	alreadySaved: boolean;
	onCreate: ManualEntryCreateHandler;
}): Promise<ManualEntryDestinationResult> => {
	const destinationLabel = getDestinationLabel(saveDestination);

	const listResult = await addFoodToSmoothieList(saveDestination, food);
	if (listResult === "error") {
		return {
			ok: false,
			error: `${food.description} was saved, but could not be added to ${destinationLabel}. Try adding it again.`,
		};
	}

	await onCreate(food, {
		destination: saveDestination,
		addedToList: true,
		source: "manual-entry",
	});

	return {
		ok: true,
		food,
		destination: saveDestination,
		addedToList: true,
		message:
			listResult === "duplicate"
				? `${food.description} is already in ${destinationLabel}.`
				: alreadySaved
					? `${food.description} is already saved and is now in ${destinationLabel}.`
					: `${food.description} saved and added to ${destinationLabel}.`,
	};
};

export const moveManualEntryOutcome = async (
	lastOutcome: CustomIngredientOutcomeState,
	destination: SmoothieListKey,
): Promise<ManualEntryDestinationResult> => {
	const addResult = await addFoodToSmoothieList(destination, lastOutcome.food);
	if (addResult === "error") {
		return {
			ok: false,
			error: `Could not move ${lastOutcome.food.description}. Try again.`,
		};
	}

	const removeResult = await removeFoodFromSmoothieList(
		lastOutcome.destination,
		lastOutcome.food.fdcId,
	);
	if (removeResult === "error") {
		return {
			ok: false,
			error: `${lastOutcome.food.description} was added to ${getListDestinationLabel(destination)}, but the old copy could not be removed.`,
		};
	}

	return {
		ok: true,
		food: lastOutcome.food,
		destination,
		addedToList: true,
		message: `${lastOutcome.food.description} moved to ${getListDestinationLabel(destination)}.`,
	};
};

export const undoManualEntryOutcomeAdd = async (
	lastOutcome: CustomIngredientOutcomeState,
): Promise<ManualEntryDestinationResult> => {
	const removeResult = await removeFoodFromSmoothieList(
		lastOutcome.destination,
		lastOutcome.food.fdcId,
	);
	if (removeResult === "error") {
		return {
			ok: false,
			error: `Could not undo adding ${lastOutcome.food.description}. Try again.`,
		};
	}

	return {
		ok: true,
		food: lastOutcome.food,
		destination: lastOutcome.destination,
		addedToList: false,
		message: `${lastOutcome.food.description} removed from ${getListDestinationLabel(lastOutcome.destination)}.`,
	};
};

export const runManualEntryOutcomeAction = async (
	params:
		| {
				action: "move";
				lastOutcome: CustomIngredientOutcomeState;
				destination: SmoothieListKey;
		  }
		| {
				action: "undo";
				lastOutcome: CustomIngredientOutcomeState;
		  },
) =>
	params.action === "move"
		? moveManualEntryOutcome(params.lastOutcome, params.destination)
		: undoManualEntryOutcomeAdd(params.lastOutcome);
