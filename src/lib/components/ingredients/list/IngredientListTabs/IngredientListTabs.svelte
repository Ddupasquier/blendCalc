<script lang="ts">
	import { pushState } from "$app/navigation";
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

	const selectList = (listKey: string) => {
		if (listKey !== MIX_STORAGE_KEYS.fridge &&
			listKey !== MIX_STORAGE_KEYS.shoppingList) {
			return;
		}
		const href = buildIngredientListTabHref(page.url, listKey);
		const currentHref = `${page.url.pathname}${page.url.search}${page.url.hash}`;
		if (href === currentHref) return;
		pushState(href, { ...page.state });
	};
</script>

<SegmentedControl
	label="Saved ingredient lists"
	options={tabOptions}
	value={activeList}
	onSelect={selectList}
/>
