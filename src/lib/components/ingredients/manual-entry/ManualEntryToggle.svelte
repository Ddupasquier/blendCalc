<script lang="ts">
	import ChevronDown from "$lib/assets/icons/ChevronDown.svelte";
	import Pencil from "$lib/assets/icons/Pencil.svelte";

	let {
		title = "Enter manually",
		description = "Add a custom ingredient by hand",
	}: {
		title?: string;
		description?: string;
	} = $props();
</script>

<span class="manual-entry-toggle__icon" aria-hidden="true">
	<Pencil class="manual-entry-toggle__pencil" />
</span>
<span class="manual-entry-toggle__copy">
	<strong>{title}</strong>
	<small>{description}</small>
</span>
<ChevronDown class="manual-entry-toggle__chevron" />

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.manual-entry-toggle__icon {
		display: inline-grid;
		place-items: center;
		width: $ingredient-food-icon-size;
		height: $ingredient-food-icon-size;
		color: $ingredient-accent-info;
		background: color-mix(in srgb, $ingredient-accent-info 11%, $ingredient-surface-card);
		border-radius: $ingredient-radius-card;

		:global(.manual-entry-toggle__pencil) {
			width: $app-gap-md;
			height: $app-gap-md;
		}
	}

	.manual-entry-toggle__copy {
		display: grid;
		gap: calc($app-gap-xs / 5);
		min-width: 0;

		strong,
		small {
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		strong {
			color: $ingredient-text-primary;
			font-size: $app-font-size-lg;
			font-weight: $app-font-weight-bold;
		}

		small {
			color: $ingredient-text-muted;
			font-size: $app-font-size-sm;
			font-weight: $app-font-weight-medium;
		}
	}

	:global(.manual-entry-toggle__chevron) {
		width: $app-gap-sm;
		height: $app-gap-sm;
		flex: 0 0 auto;
		transition: transform 180ms ease;
	}

	:global(.custom-ingredient__manual[open] .manual-entry-toggle__chevron) {
		transform: rotate(180deg);
	}
</style>
