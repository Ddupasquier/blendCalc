<script lang="ts">
	import type { ModeratorReviewListProps } from "./types";

	let {
		label,
		itemCount,
		singularItemLabel,
		pluralItemLabel,
		emptyTitle,
		emptyDescription,
		children,
	}: ModeratorReviewListProps = $props();

	const resultLabel = $derived(
		`${itemCount} ${itemCount === 1 ? singularItemLabel : pluralItemLabel}`,
	);
</script>

<section class="moderator-review-list" aria-label={label}>
	<p class="moderator-review-list__count" aria-live="polite">{resultLabel}</p>
	{#if itemCount > 0}
		<div class="moderator-review-list__items">
			{@render children()}
		</div>
	{:else}
		<div class="moderator-review-list__empty">
			<strong>{emptyTitle}</strong>
			<p>{emptyDescription}</p>
		</div>
	{/if}
</section>

<style lang="scss">
	@use "./ModeratorReviewList.scss";
</style>
