<script lang="ts">
	import type { FoodQuality } from "$lib/utils/food/foodQuality";

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
			<span class="confidence-details__indicator" aria-hidden="true">!</span>
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
				⌄
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
	@use "../../../styles/variables" as *;

	.confidence-details {
		display: grid;
		gap: $app-gap-sm;
		margin: $app-gap-sm 0;
		padding: $app-gap-sm;
		background: $app-bg;
		border: $app-border;
		border-radius: $app-radius;
		font-family: $app-font-family-interface;
	}

	.confidence-details--compact {
		margin: 0 $app-gap-md $app-gap-sm;
		padding: $app-rebuild-control-padding-y-sm;
	}

	.confidence-details__toggle {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		gap: $app-gap-sm;
		align-items: center;
		width: 100%;
		padding: 0;
		color: inherit;
		text-align: left;
		background: transparent;
		border: 0;
		border-radius: 0;

		&:hover,
		&:focus-visible {
			background: transparent;
			outline: none;

			.confidence-details__header strong {
				text-decoration: underline;
			}
		}
	}

	.confidence-details__indicator {
		display: grid;
		place-items: center;
		width: 1.2rem;
		height: 1.2rem;
		color: $app-warning-strong;
		background: $app-danger-bg;
		border-radius: $app-radius-pill;
		font-size: 0.75rem;
		font-weight: 900;
		line-height: 1;
	}

	.confidence-details__header {
		display: grid;
		gap: $app-gap-xs;

		strong {
			color: $app-primary;
			font-size: 0.78rem;
			font-weight: 800;
		}

		span {
			color: $app-muted;
			font-size: 0.7rem;
			font-weight: 700;
		}
	}

	.confidence-details__chevron {
		color: $app-primary;
		font-size: 1rem;
		font-weight: 900;
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
	}

	.confidence-detail {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: $app-gap-xs $app-gap-sm;
		align-items: center;
		padding: $app-gap-xs $app-rebuild-control-padding-y-sm;
		background: $app-section-bg;
		border: $app-border;
		border-radius: $app-radius-sm;

		span {
			min-width: 0;
			overflow: hidden;
			color: $app-primary;
			font-size: 0.74rem;
			font-weight: $app-font-weight-semibold;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		strong {
			font-size: 0.68rem;
			font-weight: 900;
			text-transform: uppercase;
		}

		small {
			grid-column: 1 / -1;
			color: $app-muted;
			font-size: 0.68rem;
			font-weight: 600;
			line-height: 1.25;
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
