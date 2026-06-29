<script lang="ts">
	import type { FdcFood } from "$lib/utils/food/types";

	let {
		food,
		active = false,
		checked = false,
		removing = false,
		kcal = null,
		icon,
		category,
		warning = null,
		sourceLabel,
		onToggle,
		onPreview,
		onActions,
		onRemove,
	}: {
		food: FdcFood;
		active?: boolean;
		checked?: boolean;
		removing?: boolean;
		kcal?: number | null;
		icon: string;
		category: string;
		warning?: string | null;
		sourceLabel: string;
		onToggle: () => void;
		onPreview: () => void;
		onActions: () => void;
		onRemove: () => void;
	} = $props();
</script>

<article
	class="saved-ingredient-card"
	class:saved-ingredient-card--active={active}
	class:saved-ingredient-card--checked={checked}
	class:saved-ingredient-card--custom={food.customFood}
>
	<button
		class="saved-ingredient-card__bulk-toggle"
		type="button"
		aria-pressed={checked}
		aria-label={`${checked ? "Uncheck" : "Check"} ${food.description}`}
		onclick={onToggle}
	>
		{#if checked}✓{/if}
	</button>
	<button
		class="saved-ingredient-card__select"
		type="button"
		aria-label={`Preview ${food.description}`}
		onclick={onPreview}
	>
		<span class="saved-ingredient-card__icon" aria-hidden="true"
			>{icon}</span
		>
		<span class="saved-ingredient-card__copy">
			<span class="saved-ingredient-card__meta">
				<span
					class="source-badge"
					class:source-badge--custom={food.customFood}
				>
					{sourceLabel}
				</span>
				{#if warning}
					<span class="warning-badge">⚠ {warning}</span>
				{/if}
			</span>
			<strong title={food.description}>{food.description}</strong>
			<small>{category}</small>
		</span>
		{#if kcal !== null}
			<span class="saved-ingredient-card__kcal">
				<strong>{kcal}</strong>
				<small>kcal/100g</small>
			</span>
		{/if}
	</button>
	<div class="saved-ingredient-card__actions">
		<button
			type="button"
			aria-label={`Open actions for ${food.description}`}
			onclick={onActions}>•••</button
		>
		<button
			type="button"
			aria-label={`Remove ${food.description}`}
			aria-busy={removing}
			disabled={removing}
			onclick={onRemove}
		>
			{removing ? "…" : "×"}
		</button>
	</div>
</article>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.saved-ingredient-card {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: $app-gap-xs;
		min-height: $ingredient-card-min-height;
		padding: $app-gap-sm;
		background: $ingredient-surface-card;
		border: 1px solid transparent;
		border-radius: $ingredient-radius-card;
		transition:
			border-color 160ms ease,
			background-color 160ms ease,
			opacity 160ms ease;
	}

	.saved-ingredient-card--active {
		border-color: $ingredient-accent-primary;
		background: $ingredient-surface-card;
	}

	.saved-ingredient-card--custom {
		border-color: color-mix(in srgb, $app-custom-strong 45%, transparent);
		background: color-mix(in srgb, $app-custom-bg 18%, $ingredient-surface-card);
	}

	.saved-ingredient-card--checked {
		opacity: 0.72;

		.saved-ingredient-card__copy strong,
		.saved-ingredient-card__copy small {
			text-decoration: line-through;
		}
	}

	.saved-ingredient-card__bulk-toggle,
	.saved-ingredient-card__actions button {
		flex: 0 0 auto;
		border: 0;
		border-radius: $ingredient-radius-pill;
		font-family: $app-button-font-family;
		font-weight: $app-button-font-weight;
		line-height: $app-button-line-height;
	}

	.saved-ingredient-card__bulk-toggle {
		display: inline-grid;
		place-items: center;
		width: calc($ingredient-action-icon-size - $app-gap-sm);
		height: calc($ingredient-action-icon-size - $app-gap-sm);
		color: $ingredient-surface-card;
		background: transparent;
		border: 2px solid
			color-mix(in srgb, $ingredient-text-muted 42%, transparent);
		font-size: $app-font-size-sm;
	}

	.saved-ingredient-card__bulk-toggle[aria-pressed="true"] {
		background: $ingredient-accent-primary;
		border-color: $ingredient-accent-primary;
	}

	.saved-ingredient-card__select {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: $app-gap-sm;
		min-width: 0;
		padding: 0;
		color: inherit;
		text-align: left;
		background: transparent;
		border: 0;
	}

	.saved-ingredient-card__icon {
		display: inline-grid;
		place-items: center;
		width: $ingredient-food-icon-size;
		height: $ingredient-food-icon-size;
		background: $ingredient-surface-positive;
		border-radius: $ingredient-radius-pill;
		font-size: 1.2rem;
	}

	.saved-ingredient-card__copy {
		display: grid;
		gap: calc($app-gap-xs / 5);
		min-width: 0;

		strong {
			overflow: hidden;
			color: $ingredient-text-primary;
			font-size: $app-font-size-md;
			font-weight: $app-font-weight-heavy;
			line-height: 1.08;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		small {
			overflow: hidden;
			color: $ingredient-text-muted;
			font-size: $app-font-size-sm;
			font-weight: $app-font-weight-medium;
			line-height: 1.15;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
	}

	.saved-ingredient-card__meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: calc($app-gap-xs / 1.7);
		min-width: 0;
	}

	.source-badge,
	.warning-badge {
		display: inline-flex;
		align-items: center;
		max-width: 8rem;
		padding: $ingredient-badge-padding-y $ingredient-badge-padding-x;
		overflow: hidden;
		border-radius: $app-radius-pill;
		font-size: 0.58rem;
		font-weight: $app-font-weight-heavy;
		line-height: 1.1;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.source-badge {
		color: color-mix(in srgb, $ingredient-accent-info 72%, $ingredient-text-primary);
		background: color-mix(in srgb, $ingredient-accent-info 18%, $ingredient-surface-card);
		text-transform: uppercase;
	}

	.source-badge--custom {
		color: $app-custom-strong;
		background: color-mix(in srgb, $app-custom-bg 55%, $ingredient-surface-card);
	}

	.warning-badge {
		color: $app-warning-strong;
		background: color-mix(in srgb, $app-highlight 22%, $app-warning-bg);
		border: 1px solid
			color-mix(in srgb, $app-highlight 70%, $app-warning-border-color);
	}

	.saved-ingredient-card__kcal {
		display: grid;
		justify-items: end;
		min-width: 2.65rem;
		color: $ingredient-accent-primary;

		strong {
			font-size: $app-font-size-md;
			font-weight: $app-font-weight-heavy;
			line-height: 1;
		}

		small {
			color: $ingredient-text-muted;
			font-size: $app-font-size-xs;
			font-weight: $app-font-weight-medium;
			line-height: 1;
		}
	}

	.saved-ingredient-card__actions {
		display: flex;
		align-items: center;
		gap: $app-gap-xs;

		button {
			display: inline-grid;
			place-items: center;
			width: $ingredient-action-icon-size;
			height: $ingredient-action-icon-size;
			color: $ingredient-text-muted;
			background: $ingredient-surface-soft;
			font-size: $app-font-size-sm;
		}

		button:disabled {
			cursor: not-allowed;
			opacity: 0.55;
		}
	}

	@media (max-width: $app-breakpoint-xs) {
		.saved-ingredient-card {
			grid-template-columns: auto minmax(0, 1fr);
		}

		.saved-ingredient-card__select {
			grid-template-columns: auto minmax(0, 1fr);
		}

		.saved-ingredient-card__kcal {
			display: none;
		}

		.saved-ingredient-card__actions {
			grid-column: 2;
			justify-content: end;
		}
	}

	button {
		display: flex;
		justify-content: center;
		align-items: center;
		text-align: center;
	}
</style>
