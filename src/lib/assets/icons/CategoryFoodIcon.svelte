<script lang="ts">
	import type { CategoryFoodIconProps } from "$lib/assets/icons/types";

	let {
		symbolKey = "generic",
		class: className = "",
		size = "1em",
		title,
	}: CategoryFoodIconProps = $props();
</script>

<svg
	class={`food-category-icon ${className}`.trim()}
	width={size}
	height={size}
	viewBox="0 0 24 24"
	aria-hidden={title ? undefined : "true"}
	role={title ? "img" : undefined}
>
	{#if title}<title>{title}</title>{/if}

	{#if symbolKey === "berries"}
		<circle class="food-category-icon__shape food-category-icon__purple" cx="9" cy="13" r="4" />
		<circle class="food-category-icon__shape food-category-icon__red" cx="15" cy="13" r="4" />
		<circle class="food-category-icon__shape food-category-icon__purple-soft" cx="12" cy="17" r="3.5" />
		<path class="food-category-icon__shape food-category-icon__green" d="M7 8c2-3 4-3 5 0 1-3 4-3 5 0-3 2-7 2-10 0Z" />
	{:else if symbolKey === "citrus"}
		<circle class="food-category-icon__shape food-category-icon__yellow" cx="12" cy="13" r="7" />
		<circle class="food-category-icon__cream-stroke" cx="12" cy="13" r="4.5" />
		<path class="food-category-icon__detail" d="M12 8.5v9M7.5 13h9M8.8 9.8l6.4 6.4M15.2 9.8l-6.4 6.4" />
		<path class="food-category-icon__shape food-category-icon__green" d="M12 6c1-3 4-4 6-2-1 3-3 4-6 2Z" />
	{:else if symbolKey === "fruit"}
		<path class="food-category-icon__shape food-category-icon__red" d="M12 8c-5-2-8 2-7 6 1 5 5 7 7 7s6-2 7-7c1-4-2-8-7-6Z" />
		<path class="food-category-icon__detail" d="M12 8c0-3 1-5 4-6" />
		<path class="food-category-icon__shape food-category-icon__green" d="M12 6c-3 0-4-2-4-4 3 0 5 1 5 3" />
	{:else if symbolKey === "leafy-greens"}
		<path class="food-category-icon__shape food-category-icon__green" d="M12 21C6 18 4 12 7 4c6 2 8 9 5 17Z" />
		<path class="food-category-icon__shape food-category-icon__green-soft" d="M12 21c-2-7 1-13 7-16 2 8-1 14-7 16Z" />
		<path class="food-category-icon__detail" d="M12 20c0-6 2-10 5-13M11 18c-1-5-2-8-3-11" />
	{:else if symbolKey === "root-vegetables"}
		<path class="food-category-icon__shape food-category-icon__orange" d="m9 8 8 2c-1 5-4 9-9 11-1-5-1-9 1-13Z" />
		<path class="food-category-icon__detail" d="m10 12 4 1M9 16l3 1" />
		<path class="food-category-icon__shape food-category-icon__green" d="M10 8C7 7 5 5 5 2c3 0 5 2 6 5M11 7c1-3 3-5 6-5 0 3-2 5-5 6" />
	{:else if symbolKey === "vegetables"}
		<path class="food-category-icon__shape food-category-icon__green-soft" d="M10 11h4l2 10H8l2-10Z" />
		<circle class="food-category-icon__shape food-category-icon__green" cx="8" cy="9" r="4" />
		<circle class="food-category-icon__shape food-category-icon__green" cx="16" cy="9" r="4" />
		<circle class="food-category-icon__shape food-category-icon__green" cx="12" cy="6" r="4" />
	{:else if symbolKey === "dairy"}
		<path class="food-category-icon__shape food-category-icon__cream" d="M8 3h8l-1 4 2 3v11H7V10l2-3-1-4Z" />
		<path class="food-category-icon__shape food-category-icon__blue-soft" d="M7 11h10v5H7z" />
		<path class="food-category-icon__detail" d="M9 7h6M11 13h2" />
	{:else if symbolKey === "eggs"}
		<path class="food-category-icon__shape food-category-icon__cream" d="M5 14c0-4 3-8 7-8s7 4 7 8c0 5-4 7-7 7s-7-2-7-7Z" />
		<circle class="food-category-icon__shape food-category-icon__yellow" cx="12" cy="14" r="3.5" />
	{:else if symbolKey === "poultry"}
		<path class="food-category-icon__shape food-category-icon__orange" d="M7 14c-2-4 1-9 5-10 4-1 7 2 6 6-1 4-7 7-11 4Z" />
		<path class="food-category-icon__detail" d="m8 14-3 3" />
		<path class="food-category-icon__shape food-category-icon__cream" d="M5 16c-2-1-4 1-2 3 1 1 2 0 3 0 0 1 1 2 2 1 2-2 0-4-3-4Z" />
	{:else if symbolKey === "meat"}
		<path class="food-category-icon__shape food-category-icon__red-soft" d="M5 16c-3-4 1-10 6-12 5-2 9 2 8 6-1 5-8 9-14 6Z" />
		<circle class="food-category-icon__shape food-category-icon__cream" cx="13" cy="9" r="2.5" />
	{:else if symbolKey === "seafood"}
		<path class="food-category-icon__shape food-category-icon__blue" d="M3 12c4-5 11-6 16 0-5 6-12 5-16 0Z" />
		<path class="food-category-icon__shape food-category-icon__blue-soft" d="m18 12 4-4v8l-4-4Z" />
		<circle class="food-category-icon__cream" cx="9" cy="10.5" r="1" />
		<path class="food-category-icon__detail" d="M14 9c-1 2-1 4 0 6" />
	{:else if symbolKey === "bread-bakery"}
		<path class="food-category-icon__shape food-category-icon__yellow" d="M5 10c0-4 3-6 7-6s7 2 7 6v9H5v-9Z" />
		<path class="food-category-icon__detail" d="m9 8 2 2M14 7l2 2M8 14h8" />
	{:else if symbolKey === "pasta-noodles"}
		<path class="food-category-icon__detail food-category-icon__detail--yellow" d="M7 5c5 0 5 3 10 3M7 9c5 0 5 3 10 3M7 13c5 0 5 3 10 3" />
		<path class="food-category-icon__shape food-category-icon__red" d="M5 17h14l-2 4H7l-2-4Z" />
	{:else if symbolKey === "grains"}
		<path class="food-category-icon__detail" d="M12 21V4" />
		<path class="food-category-icon__shape food-category-icon__yellow" d="M12 8C8 8 7 6 7 3c4 0 5 2 5 5ZM12 12c4 0 5-2 5-5-4 0-5 2-5 5ZM12 16c-4 0-5-2-5-5 4 0 5 2 5 5ZM12 20c4 0 5-2 5-5-4 0-5 2-5 5Z" />
	{:else if symbolKey === "legumes"}
		<path class="food-category-icon__shape food-category-icon__green" d="M4 15C8 6 15 4 21 8c-3 8-10 11-17 7Z" />
		<circle class="food-category-icon__green-soft" cx="9" cy="12" r="1.6" />
		<circle class="food-category-icon__green-soft" cx="14" cy="10" r="1.6" />
		<circle class="food-category-icon__green-soft" cx="18" cy="9" r="1.4" />
	{:else if symbolKey === "nuts-seeds"}
		<path class="food-category-icon__shape food-category-icon__orange" d="M12 3c5 4 7 9 4 14-2 4-6 5-9 2-4-4 0-12 5-16Z" />
		<path class="food-category-icon__detail" d="M8 17c3-2 5-6 5-11" />
	{:else if symbolKey === "coffee-tea"}
		<path class="food-category-icon__shape food-category-icon__cream" d="M5 9h12v9c0 2-2 3-6 3s-6-1-6-3V9Z" />
		<path class="food-category-icon__shape food-category-icon__orange" d="M17 11h2a3 3 0 0 1 0 6h-2" />
		<path class="food-category-icon__detail" d="M8 6c-1-1 1-2 0-4M12 6c-1-1 1-2 0-4" />
	{:else if symbolKey === "beverage"}
		<path class="food-category-icon__shape food-category-icon__blue-soft" d="M6 8h12l-1 13H7L6 8Z" />
		<path class="food-category-icon__detail food-category-icon__detail--red" d="m11 8 3-6h4" />
		<path class="food-category-icon__shape food-category-icon__blue" d="M7 12h10l-.5 6h-9L7 12Z" />
	{:else if symbolKey === "frozen-dessert"}
		<path class="food-category-icon__shape food-category-icon__orange" d="m9 11 3 11 3-11H9Z" />
		<circle class="food-category-icon__shape food-category-icon__purple-soft" cx="12" cy="8" r="5" />
		<circle class="food-category-icon__red" cx="14" cy="6" r="1" />
	{:else if symbolKey === "spreads-preserves"}
		<path class="food-category-icon__shape food-category-icon__purple" d="M6 8h12l-1 13H7L6 8Z" />
		<path class="food-category-icon__shape food-category-icon__yellow" d="M6 4h12v4H6z" />
		<path class="food-category-icon__cream-stroke" d="M9 12h6v5H9z" />
	{:else if symbolKey === "sweets"}
		<path class="food-category-icon__shape food-category-icon__purple-soft" d="m7 9 5-3 5 3v6l-5 3-5-3V9Z" />
		<path class="food-category-icon__shape food-category-icon__red" d="m7 10-4-3v8l4-2M17 10l4-3v8l-4-2" />
		<path class="food-category-icon__detail" d="m9 9 6 6M9 15l6-6" />
	{:else if symbolKey === "oils-fats"}
		<path class="food-category-icon__shape food-category-icon__yellow" d="M9 7h6l2 4v10H7V11l2-4Z" />
		<path class="food-category-icon__shape food-category-icon__green" d="M9 3h6v4H9z" />
		<path class="food-category-icon__cream-stroke" d="M9 12h6v5H9z" />
	{:else if symbolKey === "sauces-condiments"}
		<path class="food-category-icon__shape food-category-icon__red" d="M8 8h8l2 5-1 8H7l-1-8 2-5Z" />
		<path class="food-category-icon__shape food-category-icon__cream" d="M9 3h6l1 5H8l1-5Z" />
		<path class="food-category-icon__cream-stroke" d="M9 13h6v4H9z" />
	{:else if symbolKey === "soup"}
		<path class="food-category-icon__shape food-category-icon__red" d="M4 12h16c0 6-3 9-8 9s-8-3-8-9Z" />
		<path class="food-category-icon__detail" d="M7 16h10M8 9c-2-2 1-3 0-5M13 9c-2-2 1-3 0-5M18 9c-2-2 1-3 0-5" />
	{:else if symbolKey === "protein-bar"}
		<path class="food-category-icon__shape food-category-icon__purple" d="M3 8h18v9H3V8Z" />
		<path class="food-category-icon__shape food-category-icon__purple-soft" d="m3 8 3 3-3 3M21 8l-3 3 3 3" />
		<path class="food-category-icon__detail food-category-icon__detail--cream" d="m11 9-2 4h3l-1 3 4-5h-3l1-2" />
	{:else if symbolKey === "protein-powder"}
		<path class="food-category-icon__shape food-category-icon__purple-soft" d="M6 6h12l1 15H5L6 6Z" />
		<path class="food-category-icon__shape food-category-icon__purple" d="M8 3h8v3H8z" />
		<path class="food-category-icon__detail" d="M8 13h3M13 13h3M10 11v4M14 11v4" />
	{:else if symbolKey === "packaged"}
		<path class="food-category-icon__shape food-category-icon__blue-soft" d="m4 7 8-4 8 4v10l-8 4-8-4V7Z" />
		<path class="food-category-icon__shape food-category-icon__yellow" d="m4 7 8 4 8-4-8-4-8 4Z" />
		<path class="food-category-icon__detail" d="M12 11v10M8 5l8 4" />
	{:else}
		<path class="food-category-icon__shape food-category-icon__green-soft" d="M4 9h16l-2 11H6L4 9Z" />
		<path class="food-category-icon__shape food-category-icon__yellow" d="M8 9a4 4 0 0 1 8 0" />
		<path class="food-category-icon__detail" d="M8 13h8M9 16h6" />
	{/if}
</svg>

<style lang="scss">
	@use "../../../styles/variables" as *;

	.food-category-icon {
		display: block;
		overflow: visible;
	}

	.food-category-icon__shape {
		stroke: $food-symbol-outline;
		stroke-width: $food-symbol-stroke-width;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.food-category-icon__detail,
	.food-category-icon__cream-stroke {
		fill: none;
		stroke: $food-symbol-outline;
		stroke-width: $food-symbol-detail-stroke-width;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.food-category-icon__cream-stroke {
		fill: $food-symbol-cream;
	}

	.food-category-icon__detail--yellow {
		stroke: $food-symbol-yellow-dark;
	}

	.food-category-icon__detail--red {
		stroke: $food-symbol-red;
	}

	.food-category-icon__detail--cream {
		stroke: $food-symbol-cream;
	}

	.food-category-icon__red {
		fill: $food-symbol-red;
	}

	.food-category-icon__red-soft {
		fill: $food-symbol-red-soft;
	}

	.food-category-icon__orange {
		fill: $food-symbol-orange;
	}

	.food-category-icon__yellow {
		fill: $food-symbol-yellow;
	}

	.food-category-icon__green {
		fill: $food-symbol-green;
	}

	.food-category-icon__green-soft {
		fill: $food-symbol-green-soft;
	}

	.food-category-icon__blue {
		fill: $food-symbol-blue;
	}

	.food-category-icon__blue-soft {
		fill: $food-symbol-blue-soft;
	}

	.food-category-icon__purple {
		fill: $food-symbol-purple;
	}

	.food-category-icon__purple-soft {
		fill: $food-symbol-purple-soft;
	}

	.food-category-icon__cream {
		fill: $food-symbol-cream;
	}
</style>
