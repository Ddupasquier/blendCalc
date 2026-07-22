<script lang="ts">
	import Pencil from "$lib/assets/icons/Pencil/Pencil.svelte";
	import Sliders from "$lib/assets/icons/Sliders/Sliders.svelte";
	import Trash from "$lib/assets/icons/Trash/Trash.svelte";
	import TwoStepConfirmation from "$lib/components/common/actions/TwoStepConfirmation/TwoStepConfirmation.svelte";
	import BottomSheet from "$lib/components/common/sheets/BottomSheet/BottomSheet.svelte";
	import BottomSheetAction from "$lib/components/common/sheets/BottomSheetAction/BottomSheetAction.svelte";
	import type { IngredientActionSheetProps } from "./types";

	let {
		open,
		title,
		removeLabel,
		removing = false,
		canAdjustImagePlacement = false,
		onClose,
		onAdjustImagePlacement,
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
		{#if canAdjustImagePlacement && onAdjustImagePlacement}
			<BottomSheetAction
				label="Adjust image placement"
				privileged
				onSelect={onAdjustImagePlacement}
			>
				{#snippet icon()}
					<Sliders />
				{/snippet}
			</BottomSheetAction>
		{/if}
		<BottomSheetAction label="Rename" onSelect={onRename}>
			{#snippet icon()}
				<Pencil />
			{/snippet}
		</BottomSheetAction>
		<TwoStepConfirmation
			actionLabel={removeLabel}
			confirmationLabel={`Tap again: ${removeLabel}`}
			message="Tap or click delete again to confirm."
			messageId="ingredient-action-delete-confirmation"
			disabled={removing}
			onConfirm={onRemove}
		>
			{#snippet children({ activate, label })}
				<BottomSheetAction
					{label}
					variant="danger"
					disabled={removing}
					onSelect={activate}
				>
					{#snippet icon()}
						<Trash />
					{/snippet}
				</BottomSheetAction>
			{/snippet}
		</TwoStepConfirmation>
	</div>
</BottomSheet>

<style lang="scss">
	@use "./IngredientActionSheet.scss";
</style>
