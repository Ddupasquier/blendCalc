<script lang="ts">
	import CircularIconFrame from "$lib/components/common/icons/CircularIconFrame/CircularIconFrame.svelte";
	import ActionRequiredCountBadge from "$lib/components/common/badges/ActionRequiredCountBadge/ActionRequiredCountBadge.svelte";
	import type { BottomSheetActionProps } from "./types";

	let {
		label,
		description,
		actionRequiredCount = 0,
		actionRequiredLabel = "actions requiring review",
		variant = "default",
		disabled = false,
		icon,
		onSelect,
	}: BottomSheetActionProps = $props();
</script>

<button
	class="bottom-sheet-action"
	class:bottom-sheet-action--move={variant === "move"}
	class:bottom-sheet-action--danger={variant === "danger"}
	class:bottom-sheet-action--has-count={actionRequiredCount > 0}
	type="button"
	{disabled}
	onclick={onSelect}
>
	<CircularIconFrame class="bottom-sheet-action__icon" decorative>
		{#if icon}
			{@render icon()}
		{/if}
	</CircularIconFrame>
	<span class="bottom-sheet-action__label">
		<strong>{label}</strong>
		{#if description}<span>{description}</span>{/if}
	</span>
	{#if actionRequiredCount > 0}
		<ActionRequiredCountBadge
			class="bottom-sheet-action__count"
			count={actionRequiredCount}
			label={actionRequiredLabel}
		/>
	{/if}
</button>

<style lang="scss">
	@use "./BottomSheetAction.scss";
</style>
