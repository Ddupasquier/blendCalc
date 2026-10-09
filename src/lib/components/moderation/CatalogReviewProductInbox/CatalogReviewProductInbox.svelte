<script lang="ts">
	import { resolve } from "$app/paths";
	import TextBadge from "$lib/components/common/badges/TextBadge/TextBadge.svelte";
	import { untrack, tick } from "svelte";
	import { createProgressiveListController } from "$lib/utils/navigation/progressiveListController.svelte";
	import {
		fetchCatalogReviewPage,
		type CatalogReviewPage,
		type CatalogReviewPageRows,
	} from "$lib/utils/moderation/catalogReviewPagination";
	import ProgressiveListFooter from "$lib/components/common/navigation/ProgressiveListFooter/ProgressiveListFooter.svelte";
	import type { CatalogReviewProductInboxProps } from "./types";

	let {
		page,
		scrollContainer,
		onPageChange = () => {},
	}: CatalogReviewProductInboxProps = $props();
	const controller = createProgressiveListController<
		CatalogReviewPageRows["products"],
		CatalogReviewPage<"products">
	>(
		untrack(() => page),
		(cursor, signal) =>
			fetchCatalogReviewPage("products", null, cursor, signal),
	);
	const products = $derived(controller.state.items);
	let previousPage = untrack(() => page);
	const preserveScroll = async (action: () => Promise<void>) => {
		const root = scrollContainer,
			position = root?.scrollTop;
		await action();
		await tick();
		if (root && position !== undefined) root.scrollTop = position;
	};
	$effect(() => {
		const current = page;
		if (current !== previousPage) {
			previousPage = current;
			void untrack(() => preserveScroll(() => controller.refresh(current)));
		}
	});
	$effect(() => {
		onPageChange(controller.state.page);
	});
	$effect(() => () => controller.destroy());
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
	<ProgressiveListFooter
		label="Products"
		loadedCount={products.length}
		total={controller.state.total}
		hasMore={controller.state.nextCursor !== null}
		loading={controller.state.loading || controller.state.refreshing}
		error={controller.state.error}
		{scrollContainer}
		onLoadMore={() => preserveScroll(controller.loadMore)}
		onRetry={() =>
			preserveScroll(
				controller.needsRefresh ? controller.refresh : controller.loadMore,
			)}
	/>
</section>

<style lang="scss">
	@use "./CatalogReviewProductInbox.scss";
</style>
