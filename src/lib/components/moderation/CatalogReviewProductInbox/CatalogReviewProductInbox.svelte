<script lang="ts">
	import { resolve } from "$app/paths";
	import TextBadge from "$lib/components/common/badges/TextBadge/TextBadge.svelte";
	import { groupCatalogReviewWorkByProduct } from "$lib/utils/moderation/catalogReviewWork";
	import type { CatalogReviewProductInboxProps } from "./types";

	let { reviewWork }: CatalogReviewProductInboxProps = $props();
	const products = $derived(groupCatalogReviewWorkByProduct(reviewWork));
	const formatBreakdown = (counts: (typeof products)[number]["counts"]) =>
		[
			counts.safetyMatches > 0
				? `${counts.safetyMatches} possible ${counts.safetyMatches === 1 ? "recall" : "recalls"}`
				: null,
			counts.conflicts > 0
				? `${counts.conflicts} ${counts.conflicts === 1 ? "conflict" : "conflicts"}`
				: null,
			counts.providerChanges > 0
				? `${counts.providerChanges} provider ${counts.providerChanges === 1 ? "change" : "changes"}`
				: null,
		]
			.filter(Boolean)
			.join(" · ");
</script>

<section
	class="catalog-review-inbox"
	aria-labelledby="catalog-review-inbox-heading"
>
	<header>
		<h2 id="catalog-review-inbox-heading">Products needing review</h2>
		<p>
			Each product appears once. Open it to review every outstanding decision
			for that UPC.
		</p>
	</header>
	<div class="catalog-review-inbox__products">
		{#each products as product (product.productId)}
			<a
				class="catalog-review-inbox__product"
				href={resolve(
					"/profile/privileged-tools/catalog-review-work/products/[productId]",
					{ productId: product.productId },
				)}
			>
				<span class="catalog-review-inbox__identity">
					<strong>{product.productName}</strong>
					{#if product.brandOwner}<small>{product.brandOwner}</small>{/if}
					<small>UPC / GTIN {product.barcode}</small>
					<span>{formatBreakdown(product.counts)}</span>
				</span>
				<TextBadge
					label={`${product.counts.total} ${product.counts.total === 1 ? "item" : "items"}`}
					tone="warning"
				/>
			</a>
		{:else}
			<p class="catalog-review-inbox__empty">
				No products need catalog review.
			</p>
		{/each}
	</div>
</section>

<style lang="scss">
	@use "./CatalogReviewProductInbox.scss";
</style>
