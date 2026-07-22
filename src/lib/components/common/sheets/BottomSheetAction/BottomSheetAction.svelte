<script lang="ts">
	import PrivilegedActionBadge from "$lib/components/common/badges/PrivilegedActionBadge/PrivilegedActionBadge.svelte";
	import CircularIconFrame from "$lib/components/common/icons/CircularIconFrame/CircularIconFrame.svelte";
	import type { BottomSheetActionProps } from "./types";

	let {
		label,
		variant = "default",
		disabled = false,
		privileged = false,
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
		{#if privileged}
			<PrivilegedActionBadge />
		{/if}
	</span>
</button>

<style lang="scss">
	@use "./BottomSheetAction.scss";
</style>
