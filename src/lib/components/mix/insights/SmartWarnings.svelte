<script lang="ts">
	import Popover from "$lib/components/common/display/Popover.svelte";
	import CircularIconFrame from "$lib/components/common/icons/CircularIconFrame.svelte";
	import type { SmartWarningsProps } from "$lib/components/mix/types";

	let { warnings = [] }: SmartWarningsProps = $props();
</script>

{#if warnings.length > 0}
	<section class="smart-warnings" aria-live="polite" aria-label="Smart warnings">
		<h4>Smart Warnings</h4>
		<div class="smart-warnings__list">
			{#each warnings as warning}
				<article class={`smart-warning smart-warning--${warning.tone}`}>
					<CircularIconFrame class="smart-warning__symbol" decorative>
						{warning.symbol}
					</CircularIconFrame>
					<div class="smart-warning__body">
						<strong>{warning.title}</strong>
						<p>{warning.message}</p>
					</div>
					{#if warning.details?.length}
						<Popover buttonLabel="Why?" title={warning.title}>
							{#if warning.detailSummary}
								<p class="smart-warning__popover-summary">
									{warning.detailSummary}
								</p>
							{/if}
							<ul class="smart-warning__details">
								{#each warning.details as detail}
									<li>
										<strong>{detail.label}</strong>
										<span>{detail.value}</span>
									</li>
								{/each}
							</ul>
						</Popover>
					{/if}
				</article>
			{/each}
		</div>
	</section>
{/if}

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.smart-warnings {
		width: 100%;
		margin-top: $app-gap-sm;
		padding: $app-gap-sm;
		background: $app-bg;
		border: $app-border;
		border-radius: $app-card-radius;

		h4 {
			margin-bottom: $app-gap-sm;
			color: $app-primary;
			font-size: $app-font-size-sm;
			font-weight: $app-font-weight-bold;
		}
	}

	.smart-warnings__list {
		display: flex;
		flex-wrap: wrap;
		gap: $app-gap-xs;
	}

	.smart-warning {
		display: inline-grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		gap: $app-gap-sm;
		align-items: center;
		max-width: 100%;
		min-height: $app-control-height;
		padding: $app-gap-xs $app-gap-sm;
		background: $app-section-bg;
		border: $app-border;
		border-radius: $app-radius;
	}

	:global(.smart-warning__symbol) {
		--circular-icon-frame-size: #{$app-status-icon-badge-size};
		--circular-icon-frame-icon-size: #{$app-font-size-xs};

		font-weight: $app-font-weight-heavy;
	}

	.smart-warning__body {
		min-width: 0;
	}

	.smart-warning--danger {
		border-color: $app-danger-bg;

		:global(.smart-warning__symbol) {
			--circular-icon-frame-color: #{$app-primary};
			--circular-icon-frame-background: #{$app-danger-bg};
		}
	}

	.smart-warning--warning {
		border-color: $app-warning-bg;

		:global(.smart-warning__symbol) {
			--circular-icon-frame-color: #{$app-primary};
			--circular-icon-frame-background: #{$app-warning-bg};
		}
	}

	.smart-warning--info {
		border-color: $app-accent;

		:global(.smart-warning__symbol) {
			--circular-icon-frame-color: #{$app-primary};
			--circular-icon-frame-background: #{$app-accent};
		}
	}

	strong {
		display: block;
		color: $app-primary;
		font-size: $app-font-size-xs;
		font-weight: $app-font-weight-bold;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	p {
		color: $app-muted;
		font-size: $app-font-size-2xs;
		font-weight: $app-font-weight-medium;
		line-height: 1.25;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.smart-warning__popover-summary {
		margin-bottom: $app-gap-sm;
		color: $app-muted;
		font-size: $app-font-size-xs;
		white-space: normal;
	}

	.smart-warning__details {
		display: grid;
		gap: $app-gap-sm;
		list-style: none;

		li {
			display: grid;
			gap: $app-gap-micro;
			padding-bottom: $app-gap-sm;
			border-bottom: $app-border;
		}

		li:last-child {
			padding-bottom: 0;
			border-bottom: 0;
		}

		strong {
			color: $app-primary;
			font-size: $app-font-size-xs;
			white-space: normal;
		}

		span {
			color: $app-muted;
			font-size: $app-font-size-xs;
			font-weight: $app-font-weight-semibold;
		}
	}
</style>
