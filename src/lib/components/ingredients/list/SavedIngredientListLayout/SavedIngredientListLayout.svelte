<script lang="ts">
	import LoadingSpinner from "$lib/components/common/feedback/LoadingSpinner/LoadingSpinner.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import IngredientListTabs from "../IngredientListTabs/IngredientListTabs.svelte";
	import type { SavedIngredientListLayoutProps } from "./types";
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
	/>

	{#if listActionError}
		<StatusMessage tone="danger" message={listActionError} />
	{/if}

	{#if listLoadingError}
		<StatusMessage tone="danger" message={listLoadingError} />
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
	@use "./SavedIngredientListLayout.scss";
</style>
