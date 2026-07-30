<script lang="ts">
	import CollapsibleSection from "$lib/components/common/disclosure/CollapsibleSection/CollapsibleSection.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import { getFoodDataQualityDisclosure } from "$lib/utils/food/quality/foodDataQuality";
	import { getFoodDataQualityMessage } from "$lib/utils/food/quality/foodDataQualityMessages";
	import type { ProductDataQualityPanelProps } from "./types";

	let { food }: ProductDataQualityPanelProps = $props();

	const disclosure = $derived(getFoodDataQualityDisclosure(food));
</script>

{#if disclosure}
	<div class="product-data-quality-panel">
		<CollapsibleSection title="Data quality" surface="panel">
			<div class="product-data-quality-panel__content">
				<p class="product-data-quality-panel__intro">
					These notes describe source records and how blendCalc assembled this
					food. They are separate from field verification.
				</p>

				<div class="product-data-quality-panel__notices">
					{#each disclosure.notices as notice (notice.code)}
						{@const presentation = getFoodDataQualityMessage(notice)}
						<StatusMessage
							tone={presentation.tone}
							title={presentation.title}
							message={presentation.message}
						/>
					{/each}
				</div>

				{#if disclosure.schemaVersion !== undefined}
					<p class="product-data-quality-panel__context">
						Source record format: version {disclosure.schemaVersion}. This is
						the source's data format, not the product revision.
					</p>
				{/if}

				<p class="product-data-quality-panel__context">
					Field sources, source attribution, and license details are listed in
					Product details.
				</p>
			</div>
		</CollapsibleSection>
	</div>
{/if}

<style lang="scss">
	@use "./ProductDataQualityPanel.scss";
</style>
