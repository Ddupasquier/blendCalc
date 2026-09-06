<script lang="ts">
	import FoodSymbol from "$lib/assets/icons/FoodSymbol/FoodSymbol.svelte";
	import IngredientCardMediaLane from "$lib/components/ingredients/card/IngredientCardMediaLane/IngredientCardMediaLane.svelte";
	import {
		getFoodImageAltText,
		pickFoodImageUrl,
		pickFoodFullImageUrl,
	} from "$lib/utils/food/images/foodImages";
	import { getStoredImagePlacement } from "$lib/utils/food/images/imagePlacement";
	import type { IngredientCardMediaProps } from "./types";

	let { food, decorative = true }: IngredientCardMediaProps = $props();

	const thumbnailUrl = $derived(pickFoodImageUrl(food.image));
	const fullImageUrl = $derived(pickFoodFullImageUrl(food.image));
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
			rotationDegrees: food.image?.rotationDegrees,
			fitMode: food.image?.fitMode,
			placementVersion: food.image?.placementVersion,
		}),
	);
	const fallbackFood = $derived({
		...food,
		image: undefined,
	});
	let failedImageUrls = $state<string[]>([]);
	let lastImageSignature = $state("");
	const renderImageUrl = $derived(
		[thumbnailUrl, fullImageUrl].find(
			(imageUrl, index, urls) =>
				Boolean(imageUrl) &&
				urls.indexOf(imageUrl) === index &&
				!failedImageUrls.includes(imageUrl),
		),
	);

	$effect(() => {
		const signature = `${thumbnailUrl}\n${fullImageUrl}`;
		if (signature === lastImageSignature) return;
		lastImageSignature = signature;
		failedImageUrls = [];
	});

	const handleImageError = () => {
		if (!renderImageUrl || failedImageUrls.includes(renderImageUrl)) return;
		failedImageUrls = [...failedImageUrls, renderImageUrl];
	};
</script>

<IngredientCardMediaLane
	imageUrl={renderImageUrl}
	alt={imageAlt}
	value={imagePlacement}
	{decorative}
	onError={handleImageError}
>
	{#snippet fallback()}
		<span class="ingredient-card-media__fallback">
			<FoodSymbol food={fallbackFood} />
		</span>
	{/snippet}
</IngredientCardMediaLane>

<style lang="scss">
	@use "./IngredientCardMedia.scss";
</style>
