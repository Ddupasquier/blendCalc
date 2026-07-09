<script lang="ts">
	import type { FoodSymbolProps } from "$lib/assets/icons/types";
	import {
		getFoodImageAltText,
		pickFoodImageUrl,
	} from "$lib/utils/food/images/foodImages";
	import { getImagePlacementCssVars } from "$lib/components/common/images/imagePlacementStyle";
	import { getFoodSymbolCatalogItem } from "$lib/utils/food/symbols/foodSymbolCatalog";

	let {
		food,
		class: className = "",
	}: FoodSymbolProps = $props();

	const symbolItem = $derived(getFoodSymbolCatalogItem(food));
	const imageUrl = $derived(pickFoodImageUrl(food.image));
	const imageAlt = $derived(
		getFoodImageAltText({
			foodName: food.description,
			role: food.image?.role,
		}),
	);
	const imageStyle = $derived(
		getImagePlacementCssVars(
			{
				cropX: food.image?.cropX,
				cropY: food.image?.cropY,
				cropZoom: food.image?.cropZoom,
			},
			"food-symbol",
		),
	);
	let imageFailed = $state(false);
	let lastImageUrl = $state("");

	$effect(() => {
		if (imageUrl !== lastImageUrl) {
			lastImageUrl = imageUrl;
			imageFailed = false;
		}
	});
</script>

{#if imageUrl && !imageFailed}
	<img
		class={`food-symbol__image ${className}`.trim()}
		src={imageUrl}
		alt={imageAlt}
		style={imageStyle}
		loading="lazy"
		decoding="async"
		onerror={() => (imageFailed = true)}
	/>
{:else}
	<span class={className} aria-hidden="true" title={symbolItem.label}>
		{symbolItem.symbol}
	</span>
{/if}

<style lang="scss">
	@use "../../../styles/variables" as *;

	.food-symbol__image {
		display: block;
		width: $ingredient-food-image-content-size;
		height: $ingredient-food-image-content-size;
		object-fit: cover;
		object-position: var(--food-symbol-focus-x, 50%) var(--food-symbol-focus-y, 50%);
		transform: translate(
				var(--food-symbol-translate-x, 0%),
				var(--food-symbol-translate-y, 0%)
			)
			scale(var(--food-symbol-zoom, 1));
		transform-origin: center;
	}
</style>
