import { describe, expect, it } from "vitest";
import {
	getManualEntryDestinationAction,
	getManualEntryBarcodeIdentityKey,
} from "$lib/components/ingredients/manual-entry/utils/listMembership";
import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";
import type { CloudIngredientListIndex } from "$lib/utils/storage/supabase/lists";

const createListIndex = ({
	fridge = [],
	shopping = [],
}: {
	fridge?: string[];
	shopping?: string[];
} = {}): CloudIngredientListIndex => ({
	[MIX_STORAGE_KEYS.fridge]: {
		foodIds: fridge.map((_, index) => index + 1),
		foodIdentityKeys: fridge,
	},
	[MIX_STORAGE_KEYS.shoppingList]: {
		foodIds: shopping.map((_, index) => index + 101),
		foodIdentityKeys: shopping,
	},
});

describe("manual entry list membership", () => {
	it("uses normalized barcode identity instead of product names", () => {
		expect(getManualEntryBarcodeIdentityKey("4006381333931")).toBe(
			"barcode:04006381333931",
		);
		expect(getManualEntryBarcodeIdentityKey("Chocolate cookies")).toBeNull();
	});

	it("disables a destination that already contains the ingredient", () => {
		const identityKey = "barcode:04006381333931";
		const action = getManualEntryDestinationAction({
			identityState: { status: "ready", identityKey },
			listIndex: createListIndex({ fridge: [identityKey] }),
			destination: MIX_STORAGE_KEYS.fridge,
		});

		expect(action).toMatchObject({
			kind: "duplicate",
			label: "Already saved",
			disabled: true,
		});
		expect(action.message).toContain("Fridge");

		const shoppingAction = getManualEntryDestinationAction({
			identityState: { status: "ready", identityKey },
			listIndex: createListIndex({ shopping: [identityKey] }),
			destination: MIX_STORAGE_KEYS.shoppingList,
		});
		expect(shoppingAction).toMatchObject({
			kind: "duplicate",
			label: "Already saved",
			disabled: true,
		});
		expect(shoppingAction.message).toContain("Shopping List");
	});

	it("offers a move in either direction when the other list contains it", () => {
		const identityKey = "barcode:04006381333931";
		const toShopping = getManualEntryDestinationAction({
			identityState: { status: "ready", identityKey },
			listIndex: createListIndex({ fridge: [identityKey] }),
			destination: MIX_STORAGE_KEYS.shoppingList,
		});
		const toFridge = getManualEntryDestinationAction({
			identityState: { status: "ready", identityKey },
			listIndex: createListIndex({ shopping: [identityKey] }),
			destination: MIX_STORAGE_KEYS.fridge,
		});

		expect(toShopping).toMatchObject({
			kind: "move",
			label: "Move to Shopping List",
			disabled: false,
			source: MIX_STORAGE_KEYS.fridge,
			foodId: 1,
		});
		expect(toFridge).toMatchObject({
			kind: "move",
			label: "Move to Fridge",
			disabled: false,
			source: MIX_STORAGE_KEYS.shoppingList,
			foodId: 101,
		});
	});

	it("fails closed when an indexed identity has no matching saved food id", () => {
		const identityKey = "barcode:04006381333931";
		const listIndex = createListIndex({ fridge: [identityKey] });
		listIndex[MIX_STORAGE_KEYS.fridge].foodIds = [];

		expect(
			getManualEntryDestinationAction({
				identityState: { status: "ready", identityKey },
				listIndex,
				destination: MIX_STORAGE_KEYS.shoppingList,
			}),
		).toMatchObject({
			kind: "error",
			label: "Refresh saved lists",
			disabled: true,
			messageTone: "warning",
		});
	});

	it("blocks while membership is loading and falls back safely on errors", () => {
		const checking = getManualEntryDestinationAction({
			identityState: { status: "checking" },
			listIndex: createListIndex(),
			destination: MIX_STORAGE_KEYS.fridge,
		});
		const fallback = getManualEntryDestinationAction({
			identityState: { status: "error" },
			listIndex: createListIndex(),
			destination: MIX_STORAGE_KEYS.fridge,
		});

		expect(checking).toMatchObject({ kind: "checking", disabled: true });
		expect(fallback).toMatchObject({ kind: "fallback", disabled: false });
		expect(fallback.message).toContain("prevent duplicate list entries");
	});
});
