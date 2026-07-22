<script lang="ts">
	import ChevronDown from "$lib/assets/icons/ChevronDown.svelte";
	import Popover from "$lib/components/common/display/Popover.svelte";
	import CircularIconFrame from "$lib/components/common/icons/CircularIconFrame.svelte";
	import CustomBadge from "$lib/components/common/display/CustomBadge.svelte";
	import CloseButton from "$lib/components/common/buttons/CloseButton/CloseButton.svelte";
	import type { IngredientCardProps } from "$lib/components/mix/types";
	import { getFoodPreferenceContext } from "$lib/utils/profile/foodPreferenceContext.svelte";
	import { getFoodPreferenceWarnings } from "$lib/utils/profile/foodPreferenceWarnings";
	import { slide } from "svelte/transition";
	import {
		SERVING_MEASURE_OPTIONS,
		type ServingMeasureUnit,
	} from "$lib/utils/serving/servingMeasureCatalog";
	import { canConvertServingUnit } from "$lib/utils/serving/servingAmount";

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
	}: IngredientCardProps = $props();

	let nutrientsOpen = $state(false);
	const foodPreferenceContext = getFoodPreferenceContext();
	const preferenceWarnings = $derived(
		getFoodPreferenceWarnings(food, foodPreferenceContext.current),
	);

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
		<CloseButton
			class="ingredient-card__remove"
			size="small"
			label={`Remove ${food.description}`}
			onclick={() => onRemove(food.fdcId)}
		/>
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
				placeholder="Amount"
				value={quantity}
				aria-label={`Quantity for ${food.description}`}
				onfocus={(event) => event.currentTarget.select()}
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
				{#each SERVING_MEASURE_OPTIONS.filter((option) => canConvertServingUnit(option.value, food)) as option}
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

	{#if preferenceWarnings.length > 0}
		<div
			class="ingredient-card__warning"
			class:ingredient-card__warning--potential={!preferenceWarnings.some((item) => item.level === "warning")}
		>
			<strong>
				{preferenceWarnings.some((item) => item.level === "warning")
					? "Potential conflict"
					: "Possible conflict"}
			</strong>
			<p>{preferenceWarnings.map((item) => item.reason).join(" ")}</p>
		</div>
	{/if}

	{#if nutrientChips.length > 0}
		<div class="ingredient-card__details">
			<button
				class="ingredient-card__details-toggle"
				type="button"
					aria-expanded={nutrientsOpen}
					onclick={() => (nutrientsOpen = !nutrientsOpen)}
				>
					Top nutrients
					<CircularIconFrame
						class={`ingredient-card__chevron ${nutrientsOpen ? "ingredient-card__chevron--open" : ""}`}
						decorative
					>
						<ChevronDown size="1em" />
					</CircularIconFrame>
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
	@use "../../../../styles/variables" as *;

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
			margin: $app-gap-micro 0 0;
			color: $app-primary;
			font-size: $app-font-size-md;
			font-weight: $app-font-weight-bold;
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
		gap: $app-gap-inline-compact;
	}

	.ingredient-card__source {
		display: inline-flex;
		width: fit-content;
		padding: $app-gap-micro $app-gap-sm;
		color: $app-muted;
		background: $app-bg;
		border: $app-border;
		border-radius: $app-radius-pill;
		font-size: $app-font-size-xs;
		font-weight: $app-font-weight-bold;
		text-transform: uppercase;
		letter-spacing: $app-letter-spacing-label;
	}

	:global(.ingredient-card__remove) {
		position: absolute;
		top: $app-gap-sm;
		right: $app-gap-sm;
	}

	.ingredient-card__controls {
		display: grid;
		grid-template-columns: minmax(4.25rem, 0.75fr) minmax(0, 1fr);
		gap: $app-gap-xs;
		align-items: end;
		min-width: 0;
	}

	label {
		display: grid;
		gap: $app-gap-2xs;
		min-width: 0;
		color: $app-muted;
		font-size: $app-font-size-xs;
		font-weight: $app-font-weight-bold;
	}

	input,
	select {
		width: 100%;
		height: $app-control-height-sm;
		min-width: 0;
		padding: 0 $app-gap-sm;
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
		gap: $app-gap-xs;
		width: fit-content;
		padding: 0;
		color: $app-primary;
		background: transparent;
		cursor: pointer;
		font-size: $app-font-size-xs;
		font-weight: $app-button-font-weight;
		line-height: $app-button-line-height;
	}

	:global(.ingredient-card__chevron) {
		--circular-icon-frame-size: #{1rem};
		--circular-icon-frame-icon-size: #{0.65rem};
		--circular-icon-frame-color: #{$app-primary};
		--circular-icon-frame-background: #{$app-accent};

		transition: transform 0.16s ease;
		transform: rotate(-90deg);
	}

	:global(.ingredient-card__chevron--open) {
		transform: rotate(0deg);
	}

	.ingredient-card__meta {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: $app-gap-xs;
		min-width: 0;
	}

	.ingredient-card__grams {
		display: inline-flex;
		align-items: baseline;
		gap: $app-gap-xs;
		width: fit-content;
		max-width: 100%;
		padding: $app-gap-2xs $app-gap-sm;
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

	.ingredient-card__warning {
		display: grid;
		gap: $app-gap-2xs;
		padding: $app-gap-sm;
		color: $app-warning-strong;
		background: $app-warning-bg;
		border: $app-warning-border;
		border-radius: $app-radius-sm;

		p {
			color: $app-primary;
			font-size: $app-font-size-xs;
			line-height: 1.35;
		}
	}

	.ingredient-card__warning--potential {
		color: $app-primary;
	}

	.ingredient-card__chips {
		display: flex;
		flex-wrap: wrap;
		gap: $app-gap-xs;

		span {
			max-width: 100%;
			padding: $app-gap-2xs $app-gap-sm;
			color: $app-primary;
			background: $app-accent;
			border: 1px solid $app-accent;
			border-radius: $app-radius-pill;
			font-size: $app-font-size-xs;
			font-weight: $app-font-weight-bold;
			overflow-wrap: anywhere;
		}
	}

	@media (max-width: $app-breakpoint-sm) {
		.ingredient-card__controls {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>
