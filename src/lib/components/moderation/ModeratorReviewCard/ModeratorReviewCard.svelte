<script lang="ts">
	import type { ModeratorReviewCardProps } from "./types";

	let {
		title,
		subtitle,
		status,
		children,
	}: ModeratorReviewCardProps = $props();
</script>

<article class="moderator-review-card">
	<header class="moderator-review-card__header">
		<div class="moderator-review-card__identity">
			<strong>{title}</strong>
			{#if subtitle}<span>{subtitle}</span>{/if}
		</div>
		{#if status}
			<div class="moderator-review-card__status">
				{@render status()}
			</div>
		{/if}
	</header>
	<div class="moderator-review-card__body">
		{@render children()}
	</div>
</article>

<style lang="scss">
	@use "./ModeratorReviewCard.scss";
</style>
