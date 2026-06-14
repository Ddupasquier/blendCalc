<script lang="ts">
	import PillRow from "$lib/components/common/PillRow.svelte";
	import type { FdcFood } from "$lib/utils/food/types";

	let {
		fridgeItems,
		shoppingItems,
		selectedFoodIds,
		onToggleFood,
	}: {
		fridgeItems: FdcFood[];
		shoppingItems: FdcFood[];
		selectedFoodIds: number[];
		onToggleFood: (foodId: number) => void;
	} = $props();

	const getActiveIndices = (items: FdcFood[]) => {
		return items
			.map((food, index) =>
				selectedFoodIds.includes(food.fdcId) ? index : -1,
			)
			.filter((index) => index !== -1);
	};

	const getCustomIndices = (items: FdcFood[]) => {
		return items
			.map((food, index) => (food.customFood ? index : -1))
			.filter((index) => index !== -1);
	};
</script>

<section class="setup-card setup-card--ingredients">
	<div class="section-heading">
		<h4>Choose Ingredients</h4>
		<p>Select items from your fridge or shopping list.</p>
	</div>
	<div class="ingredient-lists" aria-label="Smoothie ingredients">
		<section class="ingredient-list">
			<h5>Fridge</h5>
			{#if fridgeItems.length > 0}
				<PillRow
					pills={fridgeItems.map((food) => food.description)}
					onRemove={(index) => onToggleFood(fridgeItems[index].fdcId)}
					onSelect={(index) => onToggleFood(fridgeItems[index].fdcId)}
					activeIndices={getActiveIndices(fridgeItems)}
					customIndices={getCustomIndices(fridgeItems)}
				/>
			{:else}
				<p>No fridge items yet.</p>
			{/if}
		</section>

		<section class="ingredient-list">
			<h5>Shopping List</h5>
			{#if shoppingItems.length > 0}
				<PillRow
					pills={shoppingItems.map((food) => food.description)}
					onRemove={(index) => onToggleFood(shoppingItems[index].fdcId)}
					onSelect={(index) => onToggleFood(shoppingItems[index].fdcId)}
					activeIndices={getActiveIndices(shoppingItems)}
					customIndices={getCustomIndices(shoppingItems)}
				/>
			{:else}
				<p>No shopping list items yet.</p>
			{/if}
		</section>
	</div>
</section>

<style lang="scss">
	@use "../../../styles/variables" as *;

	.setup-card {
		padding: $app-gap-sm;
		background: $app-bg;
		border: $app-border;
		border-radius: $app-card-radius;
	}

	.section-heading {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		gap: $app-gap-sm;
		margin-bottom: $app-gap-sm;

		h4 {
			color: $app-primary;
			font-size: $app-font-size-lg;
			font-weight: 800;
		}

		p {
			color: $app-muted;
			font-size: $app-font-size-sm;
			line-height: 1.35;
		}
	}

	.ingredient-lists {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: $app-gap-sm;
	}

	.ingredient-list {
		min-width: 0;
		max-height: 13rem;
		overflow: auto;
		padding: 0;
		background: $app-section-bg;
		border: $app-border;
		border-radius: $app-card-radius;

		h5 {
			position: sticky;
			top: 0;
			z-index: 2;
			margin: 0 0 0.35rem;
			padding: 0.45rem;
			color: $app-primary;
			background: $app-section-bg;
			border-bottom: $app-border;
			font-size: $app-font-size-sm;
			font-weight: 800;
		}

		p {
			padding: 0 0.45rem 0.45rem;
			color: $app-muted;
			font-size: $app-font-size-sm;
		}

		:global(.pill-row) {
			gap: 0.3rem;
			margin: 0;
			padding: 0 0.45rem 0.45rem;
		}

		:global(.pill) {
			max-width: 100%;
			padding: 0.16rem 0.55rem;
			font-size: $app-font-size-sm;
			line-height: $app-button-line-height;
			overflow-wrap: anywhere;
		}

		:global(.pill-remove) {
			flex-shrink: 0;
			font-size: 1rem;
		}
	}

	@media (max-width: $app-breakpoint-md) {
		.ingredient-lists {
			grid-template-columns: 1fr;
		}

		.section-heading {
			display: grid;
		}
	}
</style>
