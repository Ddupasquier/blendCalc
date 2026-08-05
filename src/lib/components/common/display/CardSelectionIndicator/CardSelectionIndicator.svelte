<script lang="ts">
	import Check from "$lib/assets/icons/Check/Check.svelte";
	import type { CardSelectionIndicatorProps } from "./types";

	let {
		selected = false,
		variant = "checkmark",
	}: CardSelectionIndicatorProps = $props();
</script>

<span
	class="card-selection-indicator"
	class:card-selection-indicator--selected={selected}
	class:card-selection-indicator--circle={variant === "circle"}
	aria-hidden="true"
>
	{#if selected}
		<Check size="1.25em" strokeWidth={3} />
	{/if}
</span>

<style lang="scss">
	@use "./CardSelectionIndicator.scss";
</style>
