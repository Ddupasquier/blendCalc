<script lang="ts">
	import { page } from "$app/state";
	import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";
	import SegmentedControl from "$lib/components/common/buttons/SegmentedControl/SegmentedControl.svelte";
	import type { IngredientListTabsProps } from "./types";
	import { buildIngredientListTabHref } from "$lib/utils/ingredients/ingredientRouteState";
	import {
		getSavedIngredientListTabId,
		SAVED_INGREDIENT_LIST_PANEL_ID,
	} from "$lib/components/ingredients/list/accessibilityIds";

	let {
		activeList,
		fridgeCount,
		shoppingListCount,
	}: IngredientListTabsProps = $props();

	const tabOptions = $derived([
		{
			value: MIX_STORAGE_KEYS.fridge,
			label: "Fridge",
			href: buildIngredientListTabHref(page.url, MIX_STORAGE_KEYS.fridge),
			count: fridgeCount,
			id: getSavedIngredientListTabId(MIX_STORAGE_KEYS.fridge),
			controlsId: SAVED_INGREDIENT_LIST_PANEL_ID,
		},
		{
			value: MIX_STORAGE_KEYS.shoppingList,
			label: "Shopping List",
			href: buildIngredientListTabHref(
				page.url,
				MIX_STORAGE_KEYS.shoppingList,
			),
			count: shoppingListCount,
			id: getSavedIngredientListTabId(MIX_STORAGE_KEYS.shoppingList),
			controlsId: SAVED_INGREDIENT_LIST_PANEL_ID,
		},
	]);
</script>

<SegmentedControl
	label="Saved ingredient lists"
	options={tabOptions}
	value={activeList}
/>
