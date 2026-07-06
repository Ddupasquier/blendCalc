<script lang="ts">
	import BottomSheet from "$lib/components/common/sheets/BottomSheet.svelte";
	import CustomIngredientForm from "$lib/components/ingredients/manual-entry/CustomIngredientForm.svelte";
	import type { ManualEntryCreateHandler } from "$lib/components/ingredients/manual-entry/types";

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
		onCreate: ManualEntryCreateHandler;
		onLookupStateChange?: (lookingUp: boolean) => void;
	} = $props();
</script>

<BottomSheet
	{open}
	title="Enter Manually"
	titleId="manual-entry-sheet-title"
	label="Enter a custom ingredient manually"
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
