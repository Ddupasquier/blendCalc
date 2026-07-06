<script lang="ts">
	import Popover from "$lib/components/common/display/Popover.svelte";
	import type { SmartWarning } from "$lib/utils/mix/warnings/smartWarnings";

	let { warnings = [] }: { warnings?: SmartWarning[] } = $props();
</script>

{#if warnings.length > 0}
	<section class="smart-warnings" aria-live="polite" aria-label="Smart warnings">
		<h4>Smart Warnings</h4>
		<div class="smart-warnings__list">
			{#each warnings as warning}
				<article class={`smart-warning smart-warning--${warning.tone}`}>
					<span class="smart-warning__symbol" aria-hidden="true">
						{warning.symbol}
					</span>
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
		padding: 0.55rem;
		background: $app-bg;
		border: $app-border;
		border-radius: $app-card-radius;

		h4 {
			margin-bottom: 0.45rem;
			color: $app-primary;
			font-size: 0.92rem;
			font-weight: 800;
		}
	}

	.smart-warnings__list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.smart-warning {
		display: inline-grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		gap: 0.4rem;
		align-items: center;
		max-width: 100%;
		min-height: 2.25rem;
		padding: 0.35rem 0.45rem;
		background: $app-section-bg;
		border: $app-border;
		border-radius: $app-radius;
	}

	.smart-warning__symbol {
		display: grid;
		place-items: center;
		width: 1.25rem;
		height: 1.25rem;
		border-radius: $app-radius-pill;
		font-size: 0.68rem;
		font-weight: 900;
	}

	.smart-warning__body {
		min-width: 0;
	}

	.smart-warning--danger {
		border-color: $app-danger-bg;

		.smart-warning__symbol {
			color: $app-primary;
			background: $app-danger-bg;
		}
	}

	.smart-warning--warning {
		border-color: $app-warning-bg;

		.smart-warning__symbol {
			color: $app-primary;
			background: $app-warning-bg;
		}
	}

	.smart-warning--info {
		border-color: $app-accent;

		.smart-warning__symbol {
			color: $app-primary;
			background: $app-accent;
		}
	}

	strong {
		display: block;
		color: $app-primary;
		font-size: 0.76rem;
		font-weight: 800;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	p {
		color: $app-muted;
		font-size: 0.7rem;
		font-weight: 600;
		line-height: 1.25;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.smart-warning__popover-summary {
		margin-bottom: $app-gap-sm;
		color: $app-muted;
		font-size: 0.82rem;
		white-space: normal;
	}

	.smart-warning__details {
		display: grid;
		gap: 0.4rem;
		list-style: none;

		li {
			display: grid;
			gap: 0.1rem;
			padding-bottom: 0.4rem;
			border-bottom: $app-border;
		}

		li:last-child {
			padding-bottom: 0;
			border-bottom: 0;
		}

		strong {
			color: $app-primary;
			font-size: 0.78rem;
			white-space: normal;
		}

		span {
			color: $app-muted;
			font-size: 0.74rem;
			font-weight: 700;
		}
	}
</style>
