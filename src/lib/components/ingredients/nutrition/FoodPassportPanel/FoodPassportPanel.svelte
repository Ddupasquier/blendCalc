<script lang="ts">
	import CollapsibleSection from "$lib/components/common/disclosure/CollapsibleSection/CollapsibleSection.svelte";
	import { getFoodPassportPresentation } from "$lib/utils/food/records/foodPassport";
	import type { FoodPassportPanelProps } from "./types";

	let { food, children }: FoodPassportPanelProps = $props();
	const passport = $derived(getFoodPassportPresentation(food));
	const passportElementId = $derived(
		`food-passport-${String(food.sharedProductId ?? food.fdcId).replace(/[^a-zA-Z0-9_-]/g, "-")}`,
	);
</script>

<div class="food-passport-panel">
	<CollapsibleSection
		title="Food passport"
		badge={passport.statusLabel}
		surface="panel"
	>
		<div class="food-passport-panel__content">
			<p class="food-passport-panel__summary">{passport.summary}</p>

			{#if passport.historyRows.length > 0}
				<section class="food-passport-panel__section" aria-labelledby={`${passportElementId}-history-title`}>
					<h2 id={`${passportElementId}-history-title`}>Record history</h2>
					<dl class="food-passport-panel__rows">
						{#each passport.historyRows as row}
							<div class="food-passport-panel__row">
								<dt>{row.label}</dt>
								<dd>{row.value}</dd>
							</div>
						{/each}
					</dl>
				</section>
			{/if}

			<section class="food-passport-panel__section" aria-labelledby={`${passportElementId}-coverage-title`}>
				<h2 id={`${passportElementId}-coverage-title`}>Information available</h2>
				<dl class="food-passport-panel__rows">
					{#each passport.availabilityRows as row}
						<div class="food-passport-panel__row" data-available={row.available}>
							<dt>{row.label}</dt>
							<dd>{row.value}</dd>
						</div>
					{/each}
				</dl>
				<p class="food-passport-panel__note">
					Not provided means the current record does not include that information. It does not mean zero, none, or allergen-free.
				</p>
			</section>

			{#if children}
				<div class="food-passport-panel__details">
					{@render children()}
				</div>
			{/if}
		</div>
	</CollapsibleSection>
</div>

<style lang="scss">
	@use "./FoodPassportPanel.scss";
</style>
