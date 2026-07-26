<script lang="ts">
	import BottomSheet from "$lib/components/common/sheets/BottomSheet/BottomSheet.svelte";
	import CustomIngredientForm from "$lib/components/ingredients/manual-entry/CustomIngredientForm/CustomIngredientForm.svelte";
	import { clearManualEntryDraft } from "$lib/components/ingredients/manual-entry/CustomIngredientForm/manualEntryDraft";
	import type { ManualEntryCreateHandler } from "$lib/components/ingredients/manual-entry/types";
	import type { ManualEntrySheetProps } from "./types";

	let {
		open,
		scanSignal = 0,
		onClose,
		onScannerClose,
		onCreate,
		onLookupStateChange = () => {},
	}: ManualEntrySheetProps = $props();

	const handleClose = () => {
		clearManualEntryDraft();
		onClose();
	};

	const handleCreate: ManualEntryCreateHandler = async (food, context) => {
		handleClose();
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
	onClose={handleClose}
>
	<CustomIngredientForm
		onCreate={handleCreate}
		{scanSignal}
		onClose={handleClose}
		{onScannerClose}
		inline={false}
		showScanButton={false}
		{onLookupStateChange}
	/>
</BottomSheet>
