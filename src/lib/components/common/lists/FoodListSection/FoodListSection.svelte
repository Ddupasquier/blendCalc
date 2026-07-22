<script lang="ts">
	import type { FoodListSectionProps } from "./types";

	let {
		title,
		count,
		ariaLabel,
		hasItems,
		placeholder,
		children,
	}: FoodListSectionProps = $props();
</script>

<section class="food-list-section">
	<h3>
		{title}
		<span>{count}</span>
	</h3>

	<div class="food-list-section__body" aria-label={ariaLabel}>
		{#if hasItems && children}
			{@render children()}
		{:else if placeholder}
			<p class="food-list-section__placeholder">{placeholder}</p>
		{/if}
	</div>
</section>

<style lang="scss">
	@use "./FoodListSection.scss";
</style>
