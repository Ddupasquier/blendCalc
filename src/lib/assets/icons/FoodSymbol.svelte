<script lang="ts">
	import type { FoodSymbolProps } from "$lib/assets/icons/types";
	import {
		getFoodImageAltText,
		pickFoodImageUrl,
	} from "$lib/utils/food/images/foodImages";
	import ImagePlacementViewport from "$lib/components/common/images/ImagePlacementViewport.svelte";
	import { getStoredImagePlacement } from "$lib/utils/food/images/imagePlacement";
	import {
		getFoodSymbolDefinition,
		resolveFoodSymbolKey,
	} from "$lib/utils/food/reference/appReferenceCatalog";

	let {
		food,
		class: className = "",
	}: FoodSymbolProps = $props();

	const symbolKey = $derived(resolveFoodSymbolKey(food));
	const symbolDefinition = $derived(getFoodSymbolDefinition(symbolKey));
	const imageUrl = $derived(pickFoodImageUrl(food.image));
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
	<span class={`food-symbol__image ${className}`.trim()}>
		<ImagePlacementViewport
			imageUrl={imageUrl}
			alt={imageAlt}
			value={imagePlacement}
			onError={() => (imageFailed = true)}
		/>
	</span>
{:else}
	<span
		class={`food-symbol__fallback ${className}`.trim()}
		title={symbolDefinition?.label ?? "Ingredient"}
		role="img"
		aria-label={symbolDefinition?.label ?? "Ingredient"}
	>
		<span class="food-symbol__emoji" aria-hidden="true">
			{symbolDefinition?.emoji}
		</span>
	</span>
{/if}

<style lang="scss">
	@use "../../../styles/variables" as *;

	.food-symbol__image {
		display: block;
		width: 100%;
		height: 100%;
	}

	.food-symbol__fallback {
		display: grid;
		width: 100%;
		height: 100%;
		place-items: center;
		font-size: $app-font-size-xl;
		line-height: 1;
	}

	.food-symbol__emoji {
		display: block;
		line-height: 1;
	}
</style>
