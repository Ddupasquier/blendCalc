<script lang="ts">
	import {
		getFoodImageAltText,
		pickFoodFullImageUrl,
	} from "$lib/utils/food/images/foodImages";
	import type { FdcFood } from "$lib/utils/food/types";

	let {
		food,
	}: {
		food?: FdcFood;
	} = $props();

	const imageUrl = $derived(pickFoodFullImageUrl(food?.image));
	const imageAlt = $derived(
		getFoodImageAltText({
			foodName: food?.description ?? "Ingredient",
			role: food?.image?.role,
		}),
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
	<figure class="product-image-panel">
		<img
			src={imageUrl}
			alt={imageAlt}
			loading="lazy"
			decoding="async"
			onerror={() => (imageFailed = true)}
		/>
	</figure>
{/if}

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.product-image-panel {
		display: grid;
		place-items: center;
		width: 100%;
		min-height: $ingredient-nutrition-product-image-min-height;
		max-height: $ingredient-nutrition-product-image-max-height;
		margin: 0;
		padding: $ingredient-card-padding;
		overflow: hidden;
		background: $ingredient-surface-card;
		border: $app-border-divider;
		border-radius: $ingredient-radius-card;
	}

	img {
		display: block;
		width: 100%;
		max-width: $ingredient-nutrition-product-image-max-width;
		height: 100%;
		max-height: $ingredient-nutrition-product-image-max-height;
		object-fit: contain;
	}
</style>
