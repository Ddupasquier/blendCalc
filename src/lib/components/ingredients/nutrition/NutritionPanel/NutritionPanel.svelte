<script lang="ts">
	import FoodPassportPanel from "$lib/components/ingredients/nutrition/FoodPassportPanel/FoodPassportPanel.svelte";
	import NutritionFactsLabel from "$lib/components/ingredients/nutrition/NutritionFactsLabel/NutritionFactsLabel.svelte";
	import NutritionListActions from "$lib/components/ingredients/nutrition/NutritionListActions/NutritionListActions.svelte";
	import MissingFoodWarningFeedback from "$lib/components/ingredients/nutrition/MissingFoodWarningFeedback/MissingFoodWarningFeedback.svelte";
	import NutritionPreferenceConflict from "$lib/components/ingredients/nutrition/NutritionPreferenceConflict/NutritionPreferenceConflict.svelte";
	import ProductCompatibilityPanel from "$lib/components/ingredients/nutrition/ProductCompatibilityPanel/ProductCompatibilityPanel.svelte";
	import ProductDataQualityPanel from "$lib/components/ingredients/nutrition/ProductDataQualityPanel/ProductDataQualityPanel.svelte";
	import ProductImagePanel from "$lib/components/ingredients/nutrition/ProductImagePanel/ProductImagePanel.svelte";
	import ProductInformationPanel from "$lib/components/ingredients/nutrition/ProductInformationPanel/ProductInformationPanel.svelte";
	import ProductIngredientsPanel from "$lib/components/ingredients/nutrition/ProductIngredientsPanel/ProductIngredientsPanel.svelte";
	import ProductSafetyAlerts from "$lib/components/ingredients/nutrition/ProductSafetyAlerts/ProductSafetyAlerts.svelte";
	import {
		DEFAULT_NUTRITION_VIEWING_GRAMS,
	} from "$lib/utils/food/nutrients/nutritionDisplay";
	import type { NutritionPanelProps } from "./types";

	let {
		food,
		showListActions = true,
		viewingGrams = DEFAULT_NUTRITION_VIEWING_GRAMS,
		viewingServing,
		listMembership = { inFridge: false, inShoppingList: false },
		canAdjustImagePlacement = false,
		onImagePlacementSave,
		provenanceOptions = [],
		onReportIncorrectInformation,
	}: NutritionPanelProps = $props();
</script>

<section class="nutrition-panel">
	<ProductImagePanel {food} mode="summary" />
	{#if food}
		<ProductSafetyAlerts {food} mode="summary" />
	{/if}
	<NutritionPreferenceConflict {food} mode="summary" />
	<NutritionFactsLabel {food} {viewingGrams} {viewingServing} {provenanceOptions} />
	{#if food}
		<ProductIngredientsPanel {food} mode="summary" />
		<ProductCompatibilityPanel {food} mode="summary" />
	{/if}
	<NutritionListActions {food} {showListActions} {listMembership} />
	{#if food}
		<div class="nutrition-panel__disclosures" aria-label="Additional food information">
			<ProductSafetyAlerts {food} mode="details" />
			<NutritionPreferenceConflict {food} mode="details" />
			<ProductIngredientsPanel {food} mode="details" />
			<ProductCompatibilityPanel {food} mode="details" />
			<FoodPassportPanel {food}>
				<div class="nutrition-panel__supplemental">
					<ProductInformationPanel {food} {onReportIncorrectInformation} />
					<ProductDataQualityPanel {food} />
					<MissingFoodWarningFeedback {food} />
				</div>
			</FoodPassportPanel>
			<ProductImagePanel
				{food}
				mode="details"
				{canAdjustImagePlacement}
				{onImagePlacementSave}
			/>
		</div>
	{/if}
</section>

<style lang="scss">
	@use "./NutritionPanel.scss";
</style>
