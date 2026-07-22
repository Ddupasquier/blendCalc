<script lang="ts">
	import CircularIconFrame from "$lib/components/common/icons/CircularIconFrame/CircularIconFrame.svelte";
	import type { BottomSheetActionProps } from "./types";

	let {
		label,
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
		<span>{label}</span>
	</span>
</button>

<style lang="scss">
	@use "./BottomSheetAction.scss";
</style>
