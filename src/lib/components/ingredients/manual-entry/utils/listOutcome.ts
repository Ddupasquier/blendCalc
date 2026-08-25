import type { ManualEntryCreateHandler } from "$lib/components/ingredients/manual-entry/types";
import type { FoodItem } from "$lib/utils/food/types";
import {
	addFoodToIngredientList,
	moveFoodToIngredientList,
	type IngredientListKey,
} from "$lib/utils/storage/client/ingredientLists";
import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";

export const getDestinationLabel = (destination: IngredientListKey) => {
	if (destination === MIX_STORAGE_KEYS.fridge) return "Fridge";
	if (destination === MIX_STORAGE_KEYS.shoppingList) return "Shopping List";
	return "Selected list";
};

export type ManualEntryDestinationResult =
	| {
			ok: true;
			food: FoodItem;
			destination: IngredientListKey;
			addedToList: boolean;
			message: string;
	  }
	| {
			ok: false;
			error: string;
			moveRequired?: false;
	  }
	| {
			ok: false;
			moveRequired: true;
			food: FoodItem;
			source: IngredientListKey;
			destination: IngredientListKey;
	  };

export const addManualEntryFoodToDestination = async ({
	food,
	saveDestination,
	alreadySaved,
	onCreate,
	allowMove = false,
}: {
	food: FoodItem;
	saveDestination: IngredientListKey;
	alreadySaved: boolean;
	onCreate: ManualEntryCreateHandler;
	allowMove?: boolean;
}): Promise<ManualEntryDestinationResult> => {
	const destinationLabel = getDestinationLabel(saveDestination);

	const listResult = allowMove
		? await moveFoodToIngredientList(saveDestination, food)
		: await addFoodToIngredientList(saveDestination, food);
	if (
		listResult === "move-required:fridge" ||
		listResult === "move-required:shopping"
	) {
		return {
			ok: false,
			moveRequired: true,
			food,
			source:
				listResult === "move-required:fridge"
					? MIX_STORAGE_KEYS.fridge
					: MIX_STORAGE_KEYS.shoppingList,
			destination: saveDestination,
		};
	}
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
				: listResult === "moved"
					? `${food.description} moved to ${destinationLabel}.`
					: alreadySaved
						? `${food.description} is already saved and is now in ${destinationLabel}.`
						: `${food.description} saved and added to ${destinationLabel}.`,
	};
};
