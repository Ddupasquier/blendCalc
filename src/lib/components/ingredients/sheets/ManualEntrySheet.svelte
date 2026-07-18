<script lang="ts">
	import BottomSheet from "$lib/components/common/sheets/BottomSheet.svelte";
	import CustomIngredientForm from "$lib/components/ingredients/manual-entry/CustomIngredientForm.svelte";
	import type { ManualEntryCreateHandler } from "$lib/components/ingredients/manual-entry/types";
	import type { ManualEntrySheetProps } from "$lib/components/ingredients/sheets/types";

	let {
		open,
		scanSignal = 0,
		onClose,
		onScannerClose,
		onCreate,
		onLookupStateChange = () => {},
	}: ManualEntrySheetProps = $props();

	const handleCreate: ManualEntryCreateHandler = async (food, context) => {
		onClose();
		await onCreate(food, context);
	};
</script>

<BottomSheet
	{open}
	title="Enter Manually"
	titleId="manual-entry-sheet-title"
	label="Enter a custom ingredient manually"
	showBack={false}
	fill
	onClose={onClose}
>
	<CustomIngredientForm
		onCreate={handleCreate}
		{scanSignal}
		{onClose}
		{onScannerClose}
		inline={false}
		showScanButton={false}
		{onLookupStateChange}
	/>
</BottomSheet>
