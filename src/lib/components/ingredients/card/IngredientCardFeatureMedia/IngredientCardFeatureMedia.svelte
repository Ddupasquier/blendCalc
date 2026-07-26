<script lang="ts">
	import FoodSymbol from "$lib/assets/icons/FoodSymbol/FoodSymbol.svelte";
	import IngredientCardFeatureImage from "$lib/components/ingredients/card/IngredientCardFeatureImage/IngredientCardFeatureImage.svelte";
	import {
		getFoodImageAltText,
		pickFoodFullImageUrl,
	} from "$lib/utils/food/images/foodImages";
	import { getStoredImagePlacement } from "$lib/utils/food/images/imagePlacement";
	import type { IngredientCardFeatureMediaProps } from "./types";

	let {
		food,
		decorative = true,
	}: IngredientCardFeatureMediaProps = $props();

	const imageUrl = $derived(pickFoodFullImageUrl(food.image));
	const imageAlt = $derived(
		getFoodImageAltText({
			foodName: food.description,
			role: food.image?.role,
		}),
	);
	const imagePlacement = $derived(
		getStoredImagePlacement({
			cropX: food.image?.cropX,
			cropY: food.image?.cropY,
			cropZoom: food.image?.cropZoom,
			fitMode: food.image?.fitMode,
			placementVersion: food.image?.placementVersion,
		}),
	);
	const fallbackFood = $derived({
		...food,
		image: undefined,
	});
	let failedImageUrl = $state("");
	const renderImageUrl = $derived(
		imageUrl && failedImageUrl !== imageUrl ? imageUrl : undefined,
	);

	const handleImageError = () => {
		failedImageUrl = imageUrl;
	};
</script>

<IngredientCardFeatureImage
	imageUrl={renderImageUrl}
	alt={imageAlt}
	value={imagePlacement}
	{decorative}
	onError={handleImageError}
>
	{#snippet fallback()}
		<span class="ingredient-card-feature-media__fallback">
			<FoodSymbol food={fallbackFood} />
		</span>
	{/snippet}
</IngredientCardFeatureImage>

<style lang="scss">
	@use "./IngredientCardFeatureMedia.scss";
</style>
