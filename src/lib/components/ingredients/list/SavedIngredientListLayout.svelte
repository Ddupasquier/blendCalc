<script lang="ts">
	import LoadingSpinner from "$lib/components/common/feedback/LoadingSpinner.svelte";
	import IngredientListTabs from "./IngredientListTabs.svelte";
	import type { SavedIngredientListLayoutProps } from "$lib/components/ingredients/list/types";
	import {
		getSavedIngredientListTabId,
		SAVED_INGREDIENT_LIST_PANEL_ID,
	} from "$lib/components/ingredients/list/accessibilityIds";

	let {
		activeList,
		fridgeCount,
		shoppingListCount,
		listLoading = false,
		listActionError = "",
		listLoadingError = "",
		onSelectList,
		children,
	}: SavedIngredientListLayoutProps = $props();
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
		<div class="saved-ingredients__loading">
			<LoadingSpinner label="Loading saved ingredients" showLabel />
		</div>
	{/if}

	<div
		id={SAVED_INGREDIENT_LIST_PANEL_ID}
		class="saved-ingredient-list-layout__body"
		role="tabpanel"
		aria-labelledby={getSavedIngredientListTabId(activeList)}
	>
		{@render children()}
	</div>
</section>

<style lang="scss">
	@use "../../../../styles/variables" as *;

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
		color: $ingredient-text-muted;
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
