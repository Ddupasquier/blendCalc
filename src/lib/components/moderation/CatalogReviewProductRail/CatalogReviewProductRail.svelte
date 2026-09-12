<script lang="ts">
	import RoundedActionLink from "$lib/components/common/buttons/RoundedActionLink/RoundedActionLink.svelte";
	import TextBadge from "$lib/components/common/badges/TextBadge/TextBadge.svelte";
	import type { CatalogReviewProductRailProps } from "./types";

	let {
		passport,
		conflictCount,
		diagnosticCount,
		pendingSubmissionId,
	}: CatalogReviewProductRailProps = $props();
	const humanizeReason = (reason: string) =>
		reason
			.replaceAll("_", " ")
			.replace(/^./u, (character) => character.toLocaleUpperCase());
</script>

<section
	class="catalog-review-product-rail"
	aria-labelledby="catalog-review-product-rail-title"
>
	<header>
		<div>
			<span>Product under review</span>
			<h2 id="catalog-review-product-rail-title">
				{passport.product.productName}
			</h2>
			<p>{passport.product.brandOwner ?? "Brand not recorded"}</p>
			<code>{passport.product.barcode}</code>
		</div>
		<TextBadge
			label={passport.product.blendCalcAPIV1Status}
			tone={passport.product.blendCalcAPIV1Status === "Ready"
				? "success"
				: "warning"}
		/>
	</header>

	<dl class="catalog-review-product-rail__status">
		<div>
			<dt>Catalog</dt>
			<dd>{passport.product.sharedCatalogStatus}</dd>
		</div>
		<div>
			<dt>blendCalc use</dt>
			<dd>
				{passport.product.usableInBlendcalc ? "Available" : "Unavailable"}
			</dd>
		</div>
		<div>
			<dt>Decisions here</dt>
			<dd>{conflictCount}</dd>
		</div>
	</dl>

	{#if passport.product.apiWithholdingReasons.length > 0}
		<section class="catalog-review-product-rail__reasons">
			<h3>Why the public API is withheld</h3>
			<ul>
				{#each passport.product.apiWithholdingReasons as reason}
					<li>{humanizeReason(reason)}</li>
				{/each}
			</ul>
		</section>
	{:else}
		<p class="catalog-review-product-rail__clear">
			No current public-API blocker is recorded.
		</p>
	{/if}

	{#if pendingSubmissionId}
		<section class="catalog-review-product-rail__pending">
			<strong>Correction waiting for approval</strong>
			<p>
				This product has already left conflict review. Approval applies the
				correction; rejection returns its unresolved conflicts here.
			</p>
			<RoundedActionLink
				href="/profile/privileged-tools/product-submissions"
				variant="primary"
				fullWidth
			>
				Review pending correction
			</RoundedActionLink>
		</section>
	{/if}

	{#if diagnosticCount > 0}
		<section class="catalog-review-product-rail__diagnostics">
			<strong
				>{diagnosticCount} Data Operations {diagnosticCount === 1
					? "diagnostic"
					: "diagnostics"}</strong
			>
			<p>
				These concern revision or provenance history. They are grouped
				separately because they are not additional catalog decisions.
			</p>
			<RoundedActionLink
				href={`/profile/privileged-tools/data-operations/products/${passport.product.id}`}
				variant="outline"
				fullWidth
			>
				Open Data Operations record
			</RoundedActionLink>
		</section>
	{/if}
</section>

<style lang="scss">
	@use "./CatalogReviewProductRail.scss";
</style>
