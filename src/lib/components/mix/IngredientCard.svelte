<script lang="ts">
	import Popover from "$lib/components/common/Popover.svelte";
	import CustomBadge from "$lib/components/common/CustomBadge.svelte";
	import type { NutrientChip } from "$lib/utils/mix/mixUi";
	import type { FdcFood } from "$lib/utils/food/types";
	import { slide } from "svelte/transition";
	import {
		SERVING_MEASURE_OPTIONS,
		type ServingMeasureUnit,
	} from "../../../defaults/servingMeasureDefaults";

	let {
		food,
		sourceLabel,
		quantity,
		unit,
		gramsLabel,
		warning = null,
		nutrientChips = [],
		onRemove,
		onServingChange,
	}: {
		food: FdcFood;
		sourceLabel: string;
		quantity: number;
		unit: ServingMeasureUnit;
		gramsLabel: string;
		warning?: string | null;
		nutrientChips?: NutrientChip[];
		onRemove: (foodId: number) => void;
		onServingChange: (
			food: FdcFood,
			quantityValue: string,
			unit: ServingMeasureUnit,
		) => void;
	} = $props();

	let nutrientsOpen = $state(false);

	const getDisplayName = (name: string, maxLength = 30): string => {
		if (name.length <= maxLength) return name;

		return `${name.slice(0, maxLength - 1).trimEnd()}…`;
	};
</script>

<article class="ingredient-card" class:ingredient-card--custom={food.customFood}>
	<header class="ingredient-card__header">
		<div>
			<div class="ingredient-card__badges">
				<span class="ingredient-card__source">{sourceLabel}</span>
				{#if food.customFood}
					<CustomBadge />
				{/if}
			</div>
			<h5 title={food.description} aria-label={food.description}>
				{getDisplayName(food.description)}
			</h5>
		</div>
		<button
			class="ingredient-card__remove"
			type="button"
			aria-label={`Remove ${food.description}`}
			onclick={() => onRemove(food.fdcId)}
		>
			×
		</button>
	</header>

	<div class="ingredient-card__controls">
		<label>
			<span>Amount</span>
			<input
				id={`ingredient-${food.fdcId}-quantity`}
				name={`ingredient-${food.fdcId}-quantity`}
				type="number"
				min="0"
				step="any"
				value={quantity}
				aria-label={`Quantity for ${food.description}`}
				oninput={(event) =>
					onServingChange(food, event.currentTarget.value, unit)}
			/>
		</label>
		<label>
			<span>Unit</span>
			<select
				id={`ingredient-${food.fdcId}-unit`}
				name={`ingredient-${food.fdcId}-unit`}
				value={unit}
				aria-label={`Measure for ${food.description}`}
				onchange={(event) =>
					onServingChange(
						food,
						String(quantity),
						event.currentTarget.value as ServingMeasureUnit,
					)}
			>
				{#each SERVING_MEASURE_OPTIONS as option}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
		</label>
	</div>

	<div class="ingredient-card__meta">
		<span class="ingredient-card__grams">Converted <strong>{gramsLabel}</strong></span>
		{#if warning}
			<Popover buttonLabel="⚠️ Estimate" title="Volume conversion estimate">
				<p>{warning}</p>
			</Popover>
		{/if}
	</div>

	{#if nutrientChips.length > 0}
		<div class="ingredient-card__details">
			<button
				class="ingredient-card__details-toggle"
				type="button"
					aria-expanded={nutrientsOpen}
					onclick={() => (nutrientsOpen = !nutrientsOpen)}
				>
					Top nutrients
					<span
						class="ingredient-card__chevron"
						class:ingredient-card__chevron--open={nutrientsOpen}
						aria-hidden="true"></span
					>
				</button>
			{#if nutrientsOpen}
				<div
					class="ingredient-card__chips"
					aria-label="Top nutrient contributions"
					transition:slide={{ duration: 160 }}
				>
					{#each nutrientChips as chip}
						<span>{chip.label} {chip.value}</span>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</article>

<style lang="scss">
	@use "../../../styles/variables" as *;

	.ingredient-card {
		position: relative;
		display: grid;
		gap: $app-gap-sm;
		padding: $app-gap-sm;
		min-width: 0;
		background: $app-section-bg;
		border: $app-border;
		border-radius: $app-card-radius;
	}

	.ingredient-card--custom {
		border-color: $app-custom-strong;
	}

	.ingredient-card__header {
		display: flex;
		justify-content: space-between;
		gap: $app-gap-sm;
		align-items: flex-start;
		min-width: 0;
		padding-right: 1.85rem;

		div {
			min-width: 0;
		}

		h5 {
			display: -webkit-box;
			margin: 0.08rem 0 0;
			color: $app-primary;
			font-size: $app-font-size-md;
			font-weight: 800;
			line-height: 1.2;
			overflow: hidden;
			-webkit-box-orient: vertical;
			-webkit-line-clamp: 2;
			line-clamp: 2;
			overflow-wrap: normal;
			word-break: normal;
		}
	}

	.ingredient-card__badges {
		display: flex;
		flex-wrap: wrap;
		gap: 0.22rem;
	}

	.ingredient-card__source {
		display: inline-flex;
		width: fit-content;
		padding: 0.1rem 0.4rem;
		color: $app-muted;
		background: $app-bg;
		border: $app-border;
		border-radius: $app-radius-pill;
		font-size: $app-font-size-xs;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.ingredient-card__remove {
		position: absolute;
		top: $app-gap-sm;
		right: $app-gap-sm;
		width: 1.75rem;
		height: 1.75rem;
		padding: 0;
		color: $app-primary;
		background: $app-accent;
		border-radius: $app-radius-pill;
		font-size: 1.1rem;
		font-weight: 800;
		line-height: 1;

		&:hover {
			background: $app-warning-bg;
			color: $app-warning-strong;
		}
	}

	.ingredient-card__controls {
		display: grid;
		grid-template-columns: minmax(4.25rem, 0.75fr) minmax(0, 1fr);
		gap: 0.3rem;
		align-items: end;
		min-width: 0;
	}

	label {
		display: grid;
		gap: 0.16rem;
		min-width: 0;
		color: $app-muted;
		font-size: $app-font-size-xs;
		font-weight: 800;
	}

	input,
	select {
		width: 100%;
		height: $app-control-height-sm;
		min-width: 0;
		padding: 0 0.45rem;
		color: $app-primary;
		background: $app-bg;
		border: $app-border;
		border-radius: $app-radius-sm;
		font-size: $app-font-size-sm;
	}

	input {
		font-family: $app-font-family-data;
		font-variant-numeric: tabular-nums;
	}

	.ingredient-card__details {
		min-width: 0;
		overflow: hidden;
	}

	.ingredient-card__details-toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		width: fit-content;
		padding: 0;
		color: $app-primary;
		background: transparent;
		cursor: pointer;
		font-size: $app-font-size-xs;
		font-weight: $app-button-font-weight;
		line-height: $app-button-line-height;
	}

	.ingredient-card__chevron {
		display: inline-grid;
		place-items: center;
		width: 1rem;
		height: 1rem;
		background: $app-accent;
		border-radius: $app-radius-pill;
		transition: transform 0.16s ease;
		transform: rotate(-90deg);

		&::before {
			content: "";
			width: 0.34rem;
			height: 0.34rem;
			border-right: 2px solid $app-primary;
			border-bottom: 2px solid $app-primary;
			transform: translateY(-0.08rem) rotate(45deg);
		}
	}

	.ingredient-card__chevron--open {
		transform: rotate(0deg);
	}

	.ingredient-card__meta {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.35rem;
		min-width: 0;
	}

	.ingredient-card__grams {
		display: inline-flex;
		align-items: baseline;
		gap: 0.25rem;
		width: fit-content;
		max-width: 100%;
		padding: 0.16rem 0.45rem;
		color: $app-muted;
		background: $app-bg;
		border: $app-border;
		border-radius: $app-radius-pill;
		font-family: $app-font-family-data;
		font-size: $app-font-size-xs;
		font-weight: $app-font-weight-bold;
		font-variant-numeric: tabular-nums;
	}

	.ingredient-card__grams strong {
		color: $app-primary;
		font-size: $app-font-size-sm;
		white-space: nowrap;
	}

	.ingredient-card__chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;

		span {
			max-width: 100%;
			padding: 0.16rem 0.45rem;
			color: $app-primary;
			background: $app-accent;
			border: 1px solid $app-accent;
			border-radius: $app-radius-pill;
			font-size: $app-font-size-xs;
			font-weight: 800;
			overflow-wrap: anywhere;
		}
	}

	@media (max-width: $app-breakpoint-sm) {
		.ingredient-card__controls {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>
