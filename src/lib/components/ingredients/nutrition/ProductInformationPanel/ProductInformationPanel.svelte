<script lang="ts">
	import CollapsibleSection from "$lib/components/common/disclosure/CollapsibleSection/CollapsibleSection.svelte";
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import { getProductInformation } from "$lib/utils/food/records/productInformation";
	import type { ProductInformationPanelProps } from "./types";

	let { food, onReportIncorrectInformation }: ProductInformationPanelProps = $props();

	const information = $derived(getProductInformation(food));
</script>

{#if information.productRows.length > 0 ||
	information.servingRows.length > 0 ||
	information.sourceRows.length > 0 ||
	information.fieldSourceRows.length > 0 ||
	information.sourceAttribution ||
	(onReportIncorrectInformation && (food.barcode || food.gtinUpc))}
	<div class="product-information-panel">
		<CollapsibleSection title="Product details" surface="panel">
			<div class="product-information-panel__content">
				{#if information.productRows.length > 0}
					<dl>
						{#each information.productRows as row}
							<div class="product-information-panel__row">
								<dt>{row.label}</dt>
								<dd>{row.value}</dd>
							</div>
						{/each}
					</dl>
				{/if}

				{#if information.servingRows.length > 0}
					<section
						class="product-information-panel__section"
						aria-labelledby="serving-details-title"
					>
						<h2 id="serving-details-title">Serving details</h2>
						<dl>
							{#each information.servingRows as row}
								<div class="product-information-panel__row">
									<dt>{row.label}</dt>
									<dd>{row.value}</dd>
								</div>
							{/each}
						</dl>
					</section>
				{/if}

				{#if information.fieldSourceRows.length > 0}
					<section
						class="product-information-panel__section"
						aria-labelledby="data-sources-title"
					>
						<h2 id="data-sources-title">Data sources</h2>
						<dl>
							{#each information.fieldSourceRows as row}
								<div class="product-information-panel__row">
									<dt>{row.label}</dt>
									<dd>{row.value}</dd>
								</div>
							{/each}
						</dl>
					</section>
				{/if}

				{#if information.sourceRows.length > 0 || information.sourceAttribution}
					<section
						class="product-information-panel__section"
						aria-labelledby="source-details-title"
					>
						<h2 id="source-details-title">Source details</h2>
						{#if information.sourceRows.length > 0}
							<dl>
								{#each information.sourceRows as row}
									<div class="product-information-panel__row">
										<dt>{row.label}</dt>
										<dd>{row.value}</dd>
									</div>
								{/each}
							</dl>
						{/if}
						{#if information.sourceAttribution}
							<div class="product-information-panel__attribution">
								<p>{information.sourceAttribution.attributionText}</p>
								<div class="product-information-panel__links">
									<a
										href={information.sourceAttribution.sourceUrl}
										target="_blank"
										rel="noopener noreferrer"
									>
										View source<span class="sr-only"> (opens in a new tab)</span>
									</a>
									<a
										href={information.sourceAttribution.licenseUrl}
										target="_blank"
										rel="noopener noreferrer"
									>
										{information.sourceAttribution.licenseName}<span class="sr-only">
											(opens in a new tab)</span
										>
									</a>
								</div>
							</div>
						{/if}
					</section>
				{/if}

				{#if onReportIncorrectInformation && (food.barcode || food.gtinUpc)}
					<div class="product-information-panel__correction">
						<p>Does the current package show something different?</p>
						<RoundedActionButton
							variant="soft"
							fullWidth
							onclick={onReportIncorrectInformation}
						>
							Report incorrect information
						</RoundedActionButton>
					</div>
				{/if}
			</div>
		</CollapsibleSection>
	</div>
{/if}

<style lang="scss">
	@use "./ProductInformationPanel.scss";
</style>
