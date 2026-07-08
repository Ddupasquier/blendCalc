<script lang="ts">
	import Check from "$lib/assets/icons/Check.svelte";

	let {
		checked = false,
		label,
		onToggle,
	}: {
		checked?: boolean;
		label: string;
		onToggle: () => void;
	} = $props();
</script>

<button
	class="ingredient-bulk-toggle"
	type="button"
	aria-pressed={checked}
	aria-label={label}
	onclick={onToggle}
>
	{#if checked}<Check size={14} strokeWidth={3} />{/if}
</button>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.ingredient-bulk-toggle {
		display: inline-grid;
		place-items: center;
		flex: 0 0 auto;
		width: calc($ingredient-action-icon-size - $app-gap-sm);
		height: calc($ingredient-action-icon-size - $app-gap-sm);
		color: $ingredient-surface-card;
		font-family: $app-button-font-family;
		font-size: $app-font-size-sm;
		font-weight: $app-button-font-weight;
		line-height: $app-button-line-height;
		background: transparent;
		border: 2px solid color-mix(in srgb, $ingredient-text-muted 42%, transparent);
		border-radius: $ingredient-radius-pill;
	}

	.ingredient-bulk-toggle[aria-pressed="true"] {
		background: $ingredient-accent-primary;
		border-color: $ingredient-accent-primary;
	}
</style>
