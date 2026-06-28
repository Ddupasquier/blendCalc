<script lang="ts">
	import BottomSheet from "$lib/components/common/BottomSheet.svelte";
	import CustomIngredientForm from "$lib/components/ingredients/CustomIngredientForm.svelte";
	import type { FdcFood } from "$lib/utils/food/types";

	let {
		open,
		scanSignal = 0,
		onClose,
		onCreate,
		onLookupStateChange = () => {},
	}: {
		open: boolean;
		scanSignal?: number;
		onClose: () => void;
		onCreate: (food: FdcFood) => void | Promise<void>;
		onLookupStateChange?: (lookingUp: boolean) => void;
	} = $props();
</script>

<BottomSheet
	{open}
	label="Enter a custom ingredient manually"
	aboveNav={false}
	fill
	onClose={onClose}
>
	<CustomIngredientForm
		{onCreate}
		{scanSignal}
		{onClose}
		inline={false}
		showScanButton={false}
		{onLookupStateChange}
	/>
</BottomSheet>
