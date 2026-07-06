<script lang="ts">
	import ChevronDown from "$lib/assets/icons/ChevronDown.svelte";
	import WarningTriangle from "$lib/assets/icons/WarningTriangle.svelte";
	import type { FoodQuality } from "$lib/utils/food/quality/foodQuality";

	let {
		quality,
		compact = false,
	}: {
		quality: FoodQuality;
		compact?: boolean;
	} = $props();

	let isOpen = $state(false);
	let hasInitializedOpenState = false;

	const noteworthyDetails = $derived(
		quality.details.filter(
			(detail) =>
				detail.source === "missing" ||
				detail.source === "derived" ||
				detail.source === "fallback",
		),
	);

	const totalVitalCount = $derived(quality.completeCount + quality.missingCount);

	$effect(() => {
		if (hasInitializedOpenState) return;

		isOpen = !compact;
		hasInitializedOpenState = true;
	});
</script>

{#if quality.needsDetails && noteworthyDetails.length > 0}
	<section
		class="confidence-details {compact ? 'confidence-details--compact' : ''}"
		aria-label="Nutrition confidence details"
	>
		<button
			type="button"
			class="confidence-details__toggle"
			aria-expanded={isOpen}
			onclick={() => (isOpen = !isOpen)}
		>
			<span class="confidence-details__indicator" aria-hidden="true">
				<WarningTriangle size={12} strokeWidth={2.6} />
			</span>
			<span class="confidence-details__header">
				<strong>{quality.label} nutrition data</strong>
				<span>
					{quality.completeCount}/{totalVitalCount} vital nutrients available
				</span>
			</span>
			<span
				class="confidence-details__chevron"
				class:confidence-details__chevron--open={isOpen}
				aria-hidden="true"
			>
				<ChevronDown size={14} strokeWidth={2.4} />
			</span>
		</button>

		{#if isOpen}
			<ul>
				{#each noteworthyDetails as detail}
					<li class={`confidence-detail confidence-detail--${detail.source}`}>
						<span>{detail.label}</span>
						<strong>{detail.sourceLabel}</strong>
						<small>{detail.detail}</small>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
{/if}

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.confidence-details {
		display: grid;
		gap: $app-gap-xs;
		margin: $app-gap-sm 0 $app-gap-md;
		padding: $app-gap-xs;
		background: color-mix(
			in srgb,
			$ingredient-status-warning-bg 24%,
			$nutrition-label-bg
		);
		border: 1.5px solid
			color-mix(in srgb, $app-warning-border-color 48%, $ingredient-border-subtle);
		border-radius: $ingredient-radius-control;
		font-family: $app-font-family-interface;
	}

	.confidence-details--compact {
		margin: 0 $app-gap-md $app-gap-sm;
		padding: $app-gap-xs;
	}

	.confidence-details__toggle {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		gap: $app-gap-xs;
		align-items: center;
		width: 100%;
		padding: $app-gap-xs $app-gap-xs $app-gap-sm;
		color: inherit;
		text-align: left;
		background: transparent;
		border: 0;
		border-radius: calc($ingredient-radius-control - 0.25rem);
		cursor: pointer;

		&:hover,
		&:focus-visible {
			background: color-mix(
				in srgb,
				$ingredient-status-warning-bg 28%,
				transparent
			);
			outline: $app-focus-outline;
			outline-offset: $app-focus-outline-offset;

			.confidence-details__header strong {
				text-decoration: none;
			}
		}
	}

	.confidence-details__indicator {
		display: grid;
		place-items: center;
		width: 1.35rem;
		height: 1.35rem;
		color: $app-danger-action;
		background: $ingredient-status-error-bg;
		border-radius: $app-radius-pill;
		line-height: 1;
	}

	.confidence-details__header {
		display: grid;
		gap: 0.1rem;
		min-width: 0;

		strong {
			color: $ingredient-text-primary;
			font-size: $app-font-size-sm;
			font-weight: $app-font-weight-bold;
			line-height: 1.1;
		}

		span {
			color: $ingredient-text-muted;
			font-size: $app-font-size-xs;
			font-weight: $app-font-weight-semibold;
			line-height: 1.15;
		}
	}

	.confidence-details__chevron {
		display: grid;
		place-items: center;
		color: $ingredient-text-primary;
		line-height: 1;
		transition: transform 160ms ease;
	}

	.confidence-details__chevron--open {
		transform: rotate(180deg);
	}

	ul {
		display: grid;
		gap: $app-gap-xs;
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.confidence-detail {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.15rem $app-gap-sm;
		align-items: center;
		padding: $app-gap-sm $ingredient-control-padding-x-compact;
		background: $ingredient-surface-soft;
		border: 1.5px solid
			color-mix(in srgb, $app-warning-border-color 42%, $ingredient-border-subtle);
		border-radius: calc($ingredient-radius-control - 0.35rem);

		span {
			min-width: 0;
			overflow: hidden;
			color: $ingredient-text-primary;
			font-size: $app-font-size-xs;
			font-weight: $app-font-weight-semibold;
			line-height: 1.2;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		strong {
			color: $ingredient-text-primary;
			font-size: 0.68rem;
			font-weight: $app-font-weight-heavy;
			letter-spacing: $app-letter-spacing-label;
			line-height: 1.1;
			text-transform: uppercase;
		}

		small {
			grid-column: 1 / -1;
			color: $ingredient-text-muted;
			font-size: $app-font-size-xs;
			font-weight: $app-font-weight-medium;
			line-height: 1.3;
		}
	}

	.confidence-detail--missing strong {
		color: $app-warning-strong;
	}

	.confidence-detail--derived strong {
		color: $app-primary;
	}

	.confidence-detail--fallback strong {
		color: $app-primary;
	}
</style>
