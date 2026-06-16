<script lang="ts">
	import type { Snippet } from "svelte";

	let {
		title,
		count,
		ariaLabel,
		hasItems,
		placeholder,
		children,
	}: {
		title: string;
		count: number;
		ariaLabel: string;
		hasItems: boolean;
		placeholder?: string;
		children?: Snippet;
	} = $props();
</script>

<section class="food-list-section">
	<h3>
		{title}
		<span>{count}</span>
	</h3>

	<div class="food-list-section__body" aria-label={ariaLabel}>
		{#if hasItems && children}
			{@render children()}
		{:else if placeholder}
			<p class="food-list-section__placeholder">{placeholder}</p>
		{/if}
	</div>
</section>

<style lang="scss">
	@use "../../../styles/variables" as *;

	.food-list-section {
		min-width: 0;
		margin: 0;
		background: $app-section-bg;
		border: $app-border;
		border-radius: $app-card-radius;
		overflow: hidden;
		box-shadow: $app-card-shadow;

		h3 {
			display: flex;
			align-items: center;
			gap: $app-gap-xs;
			margin: 0;
			padding: $app-gap-xs $app-gap-sm;
			color: $app-primary;
			background: $app-section-bg;
			border-bottom: $app-border;
			font-size: $app-font-size-sm;
			font-weight: 800;

			span {
				padding: 0.08rem 0.4rem;
				color: $app-muted;
				background: $app-accent;
				border-radius: $app-radius-pill;
				font-size: $app-font-size-xs;
				line-height: 1;
			}
		}
	}

	.food-list-section__body {
		min-height: 48px;
		padding: $app-gap-sm;
		background: $app-bg;
	}

	.food-list-section__placeholder {
		margin: 0;
		color: $app-muted;
		font-size: $app-font-size-sm;
		line-height: 1.35;
	}

	:global(.food-list-section__body > .pill-row) {
		margin: 0;
		gap: 0.3rem;
	}

	:global(.food-list-section__body > .pagination) {
		margin-top: $app-gap-sm;
	}
</style>
