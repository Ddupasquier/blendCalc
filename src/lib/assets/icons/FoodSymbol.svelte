<script lang="ts">
	import type { FdcFood } from "$lib/utils/food/types";

	let {
		food,
		class: className = "",
	}: {
		food: Pick<FdcFood, "description" | "foodCategory">;
		class?: string;
	} = $props();

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
</script>

<span class={className} aria-hidden="true">{symbol}</span>
