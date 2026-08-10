<script lang="ts">
	import Reset from "$lib/assets/icons/Reset/Reset.svelte";
	import GripVertical from "$lib/assets/icons/GripVertical/GripVertical.svelte";
	import Trash from "$lib/assets/icons/Trash/Trash.svelte";
	import X from "$lib/assets/icons/X/X.svelte";
	import BottomSheet from "$lib/components/common/sheets/BottomSheet/BottomSheet.svelte";
	import BottomSheetAction from "$lib/components/common/sheets/BottomSheetAction/BottomSheetAction.svelte";
	import type { MixOptionsSheetProps } from "./types";

	let {
		open,
		canResetGoals,
		canClearIngredients,
		canResetAll,
		onClose,
		onReorganize,
		onResetGoals,
		onClearIngredients,
		onResetAll,
	}: MixOptionsSheetProps = $props();
</script>

<BottomSheet {open} title="Mix options" onClose={onClose}>
	<div class="mix-options-sheet__actions">
		<BottomSheetAction label="Reorganize" onSelect={onReorganize}>
			{#snippet icon()}<GripVertical size={19} />{/snippet}
		</BottomSheetAction>
		<BottomSheetAction
			label="Reset goals to default"
			disabled={!canResetGoals}
			onSelect={onResetGoals}
		>
			{#snippet icon()}<Reset size={19} />{/snippet}
		</BottomSheetAction>
		<BottomSheetAction
			label="Clear all ingredients"
			variant="danger"
			disabled={!canClearIngredients}
			onSelect={onClearIngredients}
		>
			{#snippet icon()}<X size={19} />{/snippet}
		</BottomSheetAction>
		<BottomSheetAction
			label="Reset everything"
			variant="danger"
			disabled={!canResetAll}
			onSelect={onResetAll}
		>
			{#snippet icon()}<Trash size={19} />{/snippet}
		</BottomSheetAction>
	</div>
</BottomSheet>

<style lang="scss">
	@use "./MixOptionsSheet.scss";
</style>
