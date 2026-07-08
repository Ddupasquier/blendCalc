<script lang="ts">
	import Pencil from "$lib/assets/icons/Pencil.svelte";
	import Trash from "$lib/assets/icons/Trash.svelte";
	import BottomSheet from "$lib/components/common/sheets/BottomSheet.svelte";
	import BottomSheetAction from "$lib/components/common/sheets/BottomSheetAction.svelte";
	import type { IngredientActionSheetProps } from "$lib/components/ingredients/sheets/types";

	let {
		open,
		title,
		removeLabel,
		removing = false,
		onClose,
		onRename,
		onRemove,
	}: IngredientActionSheetProps = $props();
</script>

<BottomSheet
	{open}
	{title}
	titleId="ingredient-action-sheet-title"
	label="Ingredient actions"
	onClose={onClose}
>
	<div class="ingredient-action-sheet__actions">
		<BottomSheetAction label="Rename" onSelect={onRename}>
			{#snippet icon()}
				<Pencil />
			{/snippet}
		</BottomSheetAction>
		<BottomSheetAction
			label={removeLabel}
			variant="danger"
			disabled={removing}
			onSelect={onRemove}
		>
			{#snippet icon()}
				<Trash />
			{/snippet}
		</BottomSheetAction>
	</div>
</BottomSheet>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.ingredient-action-sheet__actions {
		display: grid;
		gap: $app-gap-sm;
	}
</style>
