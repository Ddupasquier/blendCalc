<script lang="ts">
	import ArrowLeft from "$lib/assets/icons/ArrowLeft.svelte";
	import ViewBody from "$lib/components/common/view/ViewBody.svelte";
	import ViewFrame from "$lib/components/common/view/ViewFrame.svelte";
	import ViewTop from "$lib/components/common/view/ViewTop.svelte";
	import type { FdcFood } from "$lib/utils/food/types";
	import NutritionPanel from "./NutritionPanel.svelte";

	let {
		food,
		onClose,
	}: {
		food: FdcFood;
		onClose: () => void;
	} = $props();
</script>

<ViewFrame className="nutrition-detail-view">
	<ViewTop>
		<header class="nutrition-detail-view__header">
			<button
				class="nutrition-detail-view__back"
				type="button"
				aria-label="Back to ingredients"
				onclick={onClose}
			>
				<ArrowLeft size={20} strokeWidth={2.4} />
			</button>
			<h1 id="nutrition-detail-view-title">{food.description}</h1>
			<span class="nutrition-detail-view__source" aria-label="Linked source" title="Linked source">
				↔
			</span>
		</header>

		<section class="nutrition-detail-view__amount" aria-label="Viewing amount">
			<h2>Viewing Amount</h2>
			<div class="nutrition-detail-view__amount-controls">
				<span aria-hidden="true">−</span>
				<strong>100g</strong>
				<span aria-hidden="true">+</span>
			</div>
		</section>
	</ViewTop>

	<ViewBody scroll>
		<div class="nutrition-detail-view__panel">
			<NutritionPanel {food} />
		</div>
	</ViewBody>
</ViewFrame>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.nutrition-detail-view__header {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: $app-gap-sm;
		min-height: $ingredient-control-height;
	}

	.nutrition-detail-view__back {
		display: inline-grid;
		place-items: center;
		width: $ingredient-control-height;
		height: $ingredient-control-height;
		padding: 0;
		color: $ingredient-text-primary;
		background: $ingredient-surface-control;
		border: 0;
		border-radius: $app-radius-pill;
		cursor: pointer;

		&:focus-visible {
			outline: $app-focus-outline;
			outline-offset: $app-focus-outline-offset;
		}
	}

	h1 {
		margin: 0;
		overflow: hidden;
		color: $ingredient-text-primary;
		font-family: $app-font-family-interface;
		font-size: $app-font-size-lg;
		font-weight: $app-font-weight-bold;
		line-height: 1.15;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.nutrition-detail-view__source {
		color: $ingredient-accent-info;
		font-size: $app-font-size-md;
		font-weight: $app-font-weight-bold;
	}

	.nutrition-detail-view__amount {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: $app-gap-md;
		min-height: $ingredient-control-height;
		padding-block: $app-gap-sm;
		border-top: $app-border-divider;
		border-bottom: $app-border-divider;

		h2 {
			margin: 0;
			color: $ingredient-text-muted;
			font-size: $app-font-size-sm;
			font-weight: $app-font-weight-bold;
			letter-spacing: 0.04em;
			text-transform: uppercase;
		}
	}

	.nutrition-detail-view__amount-controls {
		display: inline-flex;
		align-items: center;
		gap: $app-gap-md;
		color: $ingredient-text-primary;

		span {
			display: inline-grid;
			place-items: center;
			width: 2rem;
			height: 2rem;
			color: $ingredient-accent-primary;
			background: $ingredient-surface-positive;
			border-radius: $app-radius-pill;
			font-size: $app-font-size-lg;
			font-weight: $app-font-weight-bold;
			line-height: 1;
		}

		strong {
			font-size: $app-font-size-md;
			font-weight: $app-font-weight-bold;
		}
	}

	.nutrition-detail-view__panel {
		display: grid;
		gap: $app-gap-md;
		padding-bottom: $app-gap-lg;
	}

	.nutrition-detail-view__panel :global(.nf-label) {
		margin-top: 0;
	}
</style>
