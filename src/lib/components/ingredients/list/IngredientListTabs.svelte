<script lang="ts">
	import { MIX_STORAGE_KEYS } from "../../../../defaults/mixDefaults";
	import type { SmoothieListKey } from "$lib/utils/storage/client/smoothieLists";

	let {
		activeList,
		fridgeCount,
		shoppingListCount,
		onSelect,
	}: {
		activeList: SmoothieListKey;
		fridgeCount: number;
		shoppingListCount: number;
		onSelect: (key: SmoothieListKey) => void;
	} = $props();
</script>

<div class="ingredient-list-tabs" role="tablist" aria-label="Saved ingredient lists">
	<button
		type="button"
		role="tab"
		class:ingredient-list-tabs__button--active={activeList === MIX_STORAGE_KEYS.fridge}
		aria-selected={activeList === MIX_STORAGE_KEYS.fridge}
		onclick={() => onSelect(MIX_STORAGE_KEYS.fridge)}
	>
		Fridge <span>{fridgeCount}</span>
	</button>
	<button
		type="button"
		role="tab"
		class:ingredient-list-tabs__button--active={activeList === MIX_STORAGE_KEYS.shoppingList}
		aria-selected={activeList === MIX_STORAGE_KEYS.shoppingList}
		onclick={() => onSelect(MIX_STORAGE_KEYS.shoppingList)}
	>
		Shopping List <span>{shoppingListCount}</span>
	</button>
</div>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.ingredient-list-tabs {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		padding: $app-gap-xs;
		background: $ingredient-surface-control;
		border-radius: $ingredient-radius-sheet;
	}

	button {
		min-height: $ingredient-control-height;
		color: $ingredient-text-muted;
		background: transparent;
		border: 0;
		border-radius: $ingredient-radius-pill;
		font-family: $app-button-font-family;
		font-size: $app-font-size-md;
		font-weight: $app-button-font-weight;
		line-height: $app-button-line-height;
		transition:
			color 160ms ease,
			background-color 160ms ease;
	}

	span {
		display: inline-block;
		min-width: 1.3rem;
		margin-left: $app-gap-badge-inline;
		padding: $ingredient-badge-padding-y $ingredient-badge-padding-x;
		color: inherit;
		background: color-mix(in srgb, $ingredient-text-muted 12%, transparent);
		border-radius: $ingredient-radius-pill;
		font-size: $app-font-size-xs;
	}

	.ingredient-list-tabs__button--active {
		color: $ingredient-text-primary;
		background: $ingredient-surface-card;
	}
</style>
