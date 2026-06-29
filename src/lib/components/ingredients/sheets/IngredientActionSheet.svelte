<script lang="ts">
	import MoveList from "$lib/assets/icons/MoveList.svelte";
	import Pencil from "$lib/assets/icons/Pencil.svelte";
	import Trash from "$lib/assets/icons/Trash.svelte";
	import BottomSheet from "$lib/components/common/BottomSheet.svelte";
	import BottomSheetAction from "$lib/components/common/BottomSheetAction.svelte";

	let {
		open,
		title,
		moveLabel,
		removeLabel,
		moving = false,
		removing = false,
		onClose,
		onRename,
		onMove,
		onRemove,
	}: {
		open: boolean;
		title: string;
		moveLabel: string;
		removeLabel: string;
		moving?: boolean;
		removing?: boolean;
		onClose: () => void;
		onRename: () => void;
		onMove: () => void;
		onRemove: () => void;
	} = $props();
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
		<BottomSheetAction label={moveLabel} variant="move" disabled={moving} onSelect={onMove}>
			{#snippet icon()}
				<MoveList />
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
