<script lang="ts">
	import Check from "$lib/assets/icons/Check/Check.svelte";
	import CircleIconButton from "$lib/components/common/buttons/CircleIconButton/CircleIconButton.svelte";
	import type { IngredientBulkToggleProps } from "./types";

	let {
		checked = false,
		label,
		onToggle,
	}: IngredientBulkToggleProps = $props();
</script>

<CircleIconButton
	{label}
	variant={checked ? "primary" : "outline"}
	size="small"
	pressed={checked}
	class="ingredient-bulk-toggle"
	onclick={onToggle}
>
	{#if checked}<Check size="1em" strokeWidth={3} />{/if}
</CircleIconButton>
