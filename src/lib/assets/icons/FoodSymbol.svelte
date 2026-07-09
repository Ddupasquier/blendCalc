<script lang="ts">
	import type { FoodSymbolProps } from "$lib/assets/icons/types";
	import {
		getFoodImageAltText,
		pickFoodImageUrl,
	} from "$lib/utils/food/images/foodImages";

	let {
		food,
		class: className = "",
	}: FoodSymbolProps = $props();

	const getSymbol = (value: string) => {
		if (value.includes("strawberry") || value.includes("berry")) return "🍓";
		if (value.includes("banana")) return "🍌";
		if (value.includes("mango")) return "🥭";
		if (value.includes("spinach") || value.includes("kale")) return "🥬";
		if (value.includes("milk") || value.includes("yogurt")) return "🥛";
		if (value.includes("beef") || value.includes("protein")) return "💪";
		if (value.includes("seed") || value.includes("nut")) return "🌰";
		return "🥤";
	};

	const text = $derived([food.description, food.foodCategory].join(" ").toLowerCase());
	const symbol = $derived(getSymbol(text));
	const imageUrl = $derived(pickFoodImageUrl(food.image));
	const imageAlt = $derived(
		getFoodImageAltText({
			foodName: food.description,
			role: food.image?.role,
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
	<img
		class={`food-symbol__image ${className}`.trim()}
		src={imageUrl}
		alt={imageAlt}
		loading="lazy"
		decoding="async"
		onerror={() => (imageFailed = true)}
	/>
{:else}
	<span class={className} aria-hidden="true">{symbol}</span>
{/if}

<style lang="scss">
	@use "../../../styles/variables" as *;

	.food-symbol__image {
		display: block;
		width: $ingredient-food-image-content-size;
		height: $ingredient-food-image-content-size;
		object-fit: cover;
	}
</style>
