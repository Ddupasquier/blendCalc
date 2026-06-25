<script lang="ts">
	import { MIX_STORAGE_KEYS } from "../../../defaults/mixDefaults";
	import type { SmoothieListKey } from "$lib/utils/storage/smoothieLists";

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
	@use "../../../styles/variables" as *;

	.ingredient-list-tabs {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		padding: $app-gap-xs;
		background: $color-figma-control-surface;
		border-radius: $app-rebuild-radius-lg;
	}

	button {
		min-height: $app-rebuild-control-height;
		color: $color-figma-muted;
		background: transparent;
		border: 0;
		border-radius: $app-rebuild-radius-pill;
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
		margin-left: calc($app-gap-xs / 1.7);
		padding: 0.08rem 0.35rem;
		color: inherit;
		background: color-mix(in srgb, $color-figma-muted 12%, transparent);
		border-radius: $app-rebuild-radius-pill;
		font-size: $app-font-size-xs;
	}

	.ingredient-list-tabs__button--active {
		color: $color-figma-ink;
		background: $color-figma-card;
	}
</style>
