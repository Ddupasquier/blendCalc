<script lang="ts">
	import { MIX_STORAGE_KEYS } from "../../../../defaults/mixDefaults";
	import SegmentedControl from "$lib/components/common/buttons/SegmentedControl/SegmentedControl.svelte";
	import type { SmoothieListKey } from "$lib/utils/storage/client/smoothieLists";
	import type { IngredientListTabsProps } from "$lib/components/ingredients/list/types";
	import {
		getSavedIngredientListTabId,
		SAVED_INGREDIENT_LIST_PANEL_ID,
	} from "$lib/components/ingredients/list/accessibilityIds";

	let {
		activeList,
		fridgeCount,
		shoppingListCount,
		onSelect,
	}: IngredientListTabsProps = $props();

	const tabOptions = $derived([
		{
			value: MIX_STORAGE_KEYS.fridge,
			label: "Fridge",
			count: fridgeCount,
			id: getSavedIngredientListTabId(MIX_STORAGE_KEYS.fridge),
			controlsId: SAVED_INGREDIENT_LIST_PANEL_ID,
		},
		{
			value: MIX_STORAGE_KEYS.shoppingList,
			label: "Shopping List",
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
	onSelect={(value) => onSelect(value as SmoothieListKey)}
/>
