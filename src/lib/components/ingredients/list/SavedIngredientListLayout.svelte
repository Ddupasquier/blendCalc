<script lang="ts">
	import type { Snippet } from "svelte";
	import type { SmoothieListKey } from "$lib/utils/storage/client/smoothieLists";
	import IngredientListTabs from "./IngredientListTabs.svelte";

	let {
		activeList,
		fridgeCount,
		shoppingListCount,
		listLoading = false,
		listActionError = "",
		listLoadingError = "",
		onSelectList,
		children,
	}: {
		activeList: SmoothieListKey;
		fridgeCount: number;
		shoppingListCount: number;
		listLoading?: boolean;
		listActionError?: string;
		listLoadingError?: string;
		onSelectList: (key: SmoothieListKey) => void;
		children: Snippet;
	} = $props();
</script>

<section
	class="saved-ingredient-list-layout"
	aria-labelledby="saved-ingredients-title"
	aria-busy={listLoading}
>
	<h2 id="saved-ingredients-title" class="sr-only">Saved ingredients</h2>
	<IngredientListTabs
		{activeList}
		{fridgeCount}
		{shoppingListCount}
		onSelect={onSelectList}
	/>

	{#if listActionError}
		<p class="list-action-error" role="alert">{listActionError}</p>
	{/if}

	{#if listLoadingError}
		<p class="list-action-error" role="alert">{listLoadingError}</p>
	{/if}

	{#if listLoading}
		<p class="saved-ingredients__loading" role="status" aria-live="polite">
			Loading saved ingredients…
		</p>
	{/if}

	<div class="saved-ingredient-list-layout__body">
		{@render children()}
	</div>
</section>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.saved-ingredient-list-layout {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		flex: 1 1 auto;
		gap: $app-vertical-stack-gap;
		min-height: 0;
		padding-top: 0;
		overflow: hidden;
	}

	.saved-ingredient-list-layout__body {
		display: flex;
		flex: 1 1 auto;
		min-height: 0;
		overflow: hidden;
	}

	.saved-ingredients__loading {
		margin: 0;
		color: $ingredient-text-muted;
		font-size: $app-font-size-sm;
		font-weight: $app-font-weight-bold;
		line-height: 1.3;
	}

	.list-action-error {
		padding: $app-gap-sm;
		color: $app-warning-strong;
		background: $app-warning-bg;
		border: $app-warning-border;
		border-radius: $app-radius;
		font-size: $app-font-size-sm;
		font-weight: $app-font-weight-bold;
	}
</style>
