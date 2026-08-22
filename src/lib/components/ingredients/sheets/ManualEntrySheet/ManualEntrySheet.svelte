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
		moveConfirmationRouteOpen = false,
		onMoveConfirmationOpen,
		onMoveConfirmationClose,
		onCreate,
		onLookupStateChange = () => {},
		initialFood,
		submissionIntent = "catalog_share",
		catalogSubmissionOnly = false,
		allowPlayfulMessages = true,
	}: ManualEntrySheetProps = $props();
	let closingAfterSuccessfulCreate = $state(false);

	$effect(() => {
		if (!open) closingAfterSuccessfulCreate = false;
	});

	const handleClose = () => {
		clearManualEntryDraft();
		onClose();
	};

	const handleCreate: ManualEntryCreateHandler = async (food, context) => {
		closingAfterSuccessfulCreate = true;
		clearManualEntryDraft();
		try {
			await onCreate(food, context);
		} catch (error) {
			closingAfterSuccessfulCreate = false;
			throw error;
		}
	};
</script>

<BottomSheet
	open={open && !closingAfterSuccessfulCreate}
	title={submissionIntent === "catalog_correction"
		? "Correct Product Information"
		: "Enter Manually"}
	titleId="manual-entry-sheet-title"
	label={submissionIntent === "catalog_correction"
		? "Submit corrected product information for review"
		: "Enter a custom ingredient manually"}
	fill
	onClose={handleClose}
>
	<CustomIngredientForm
		onCreate={handleCreate}
		{scanSignal}
		onClose={handleClose}
		{onScannerClose}
		{moveConfirmationRouteOpen}
		{onMoveConfirmationOpen}
		{onMoveConfirmationClose}
		inline={false}
		showScanButton={false}
		{onLookupStateChange}
		{initialFood}
		{submissionIntent}
		{catalogSubmissionOnly}
		{allowPlayfulMessages}
	/>
</BottomSheet>
