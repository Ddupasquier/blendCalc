<script lang="ts">
	import { MIX_STORAGE_KEYS } from "../../../../defaults/mixDefaults";
	import SegmentedControl from "$lib/components/common/buttons/SegmentedControl.svelte";
	import type { SmoothieListKey } from "$lib/utils/storage/client/smoothieLists";

	let {
		activeList,
		fridgeCount,
		shoppingListCount,
		onSelect,
	}: {
		activeList: SmoothieListKey;
		fridgeCount: number;
		shoppingListCount: number;
		onSelect: (key: SmoothieListKey) => void;
	} = $props();

	const tabOptions = $derived([
		{
			value: MIX_STORAGE_KEYS.fridge,
			label: "Fridge",
			count: fridgeCount,
		},
		{
			value: MIX_STORAGE_KEYS.shoppingList,
			label: "Shopping List",
			count: shoppingListCount,
		},
	]);
</script>

<SegmentedControl
	label="Saved ingredient lists"
	options={tabOptions}
	value={activeList}
	onSelect={(value) => onSelect(value as SmoothieListKey)}
/>
