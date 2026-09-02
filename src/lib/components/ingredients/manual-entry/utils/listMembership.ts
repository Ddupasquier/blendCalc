import {
	findCustomFoodByBarcode,
	findCustomFoodByName,
} from "$lib/utils/food/custom/customFoods";
import { getFoodIdentityKey } from "$lib/utils/food/records/foodIdentity";
import type { FoodItem } from "$lib/utils/food/types";
import { normalizeBarcode } from "$lib/utils/barcode/barcode";
import type { CloudIngredientListIndex } from "$lib/utils/storage/supabase/lists";
import type { IngredientListKey } from "$lib/utils/storage/client/ingredientLists";
import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";
import { getDestinationLabel } from "./listOutcome";

export type ManualEntryListIdentityState =
	| { status: "idle" | "checking" }
	| { status: "ready"; identityKey: string | null }
	| { status: "error" };

export type ManualEntryDestinationAction = {
	kind: "add" | "checking" | "duplicate" | "move" | "fallback" | "error";
	label: string;
	disabled: boolean;
	message: string;
	messageTone: "info" | "warning";
	source?: IngredientListKey;
	foodId?: number;
};

const getOppositeListKey = (destination: IngredientListKey) =>
	destination === MIX_STORAGE_KEYS.fridge
		? MIX_STORAGE_KEYS.shoppingList
		: MIX_STORAGE_KEYS.fridge;

export const getManualEntryBarcodeIdentityKey = (barcode: string) => {
	const normalizedBarcode = normalizeBarcode(barcode);
	return normalizedBarcode ? `barcode:${normalizedBarcode}` : null;
};

export const resolveManualEntryListIdentity = async ({
	name,
	barcode,
	initialFood,
}: {
	name: string;
	barcode: string;
	initialFood?: FoodItem;
}): Promise<string | null> => {
	const barcodeIdentityKey = getManualEntryBarcodeIdentityKey(barcode);
	if (barcodeIdentityKey) {
		const normalizedBarcode = barcodeIdentityKey.slice("barcode:".length);
		const existingFood = await findCustomFoodByBarcode(normalizedBarcode);
		return existingFood ? getFoodIdentityKey(existingFood) : barcodeIdentityKey;
	}

	if (initialFood) return getFoodIdentityKey(initialFood);

	const existingFood = await findCustomFoodByName(name);
	return existingFood ? getFoodIdentityKey(existingFood) : null;
};

export const getManualEntryDestinationAction = ({
	identityState,
	listIndex,
	destination,
}: {
	identityState: ManualEntryListIdentityState;
	listIndex: CloudIngredientListIndex;
	destination: IngredientListKey;
}): ManualEntryDestinationAction => {
	if (identityState.status === "idle" || identityState.status === "checking") {
		return {
			kind: "checking",
			label: "Checking saved lists…",
			disabled: true,
			message: "Checking your Fridge and Shopping List for this ingredient.",
			messageTone: "info",
		};
	}

	if (identityState.status === "error") {
		return {
			kind: "fallback",
			label: "Add Ingredient",
			disabled: false,
			message:
				"We couldn’t check your saved lists. Saving will still prevent duplicate list entries.",
			messageTone: "warning",
		};
	}

	if (identityState.status !== "ready" || !identityState.identityKey) {
		return {
			kind: "add",
			label: "Add Ingredient",
			disabled: false,
			message: "",
			messageTone: "info",
		};
	}

	const destinationLabel = getDestinationLabel(destination);
	if (
		listIndex[destination].foodIdentityKeys.includes(identityState.identityKey)
	) {
		return {
			kind: "duplicate",
			label: "Already saved",
			disabled: true,
			message: `Already saved in ${destinationLabel}. Choose the other list if you want to move it.`,
			messageTone: "info",
		};
	}

	const source = getOppositeListKey(destination);
	const sourceLabel = getDestinationLabel(source);
	const sourceIdentityIndex = listIndex[source].foodIdentityKeys.indexOf(
		identityState.identityKey,
	);
	if (sourceIdentityIndex >= 0) {
		const foodId = listIndex[source].foodIds[sourceIdentityIndex];
		if (!Number.isSafeInteger(foodId)) {
			return {
				kind: "error",
				label: "Refresh saved lists",
				disabled: true,
				message:
					"The existing ingredient could not be identified safely. Refresh before moving it.",
				messageTone: "warning",
			};
		}
		return {
			kind: "move",
			label: `Move to ${destinationLabel}`,
			disabled: false,
			message: `Already saved in ${sourceLabel}. Move the existing ingredient to ${destinationLabel} instead of adding another.`,
			messageTone: "info",
			source,
			foodId,
		};
	}

	return {
		kind: "add",
		label: "Add Ingredient",
		disabled: false,
		message: "",
		messageTone: "info",
	};
};
