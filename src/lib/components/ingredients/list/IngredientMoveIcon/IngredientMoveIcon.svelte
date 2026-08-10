<script lang="ts">
	import Chevron from "$lib/assets/icons/Chevron/Chevron.svelte";
	import type { IngredientMoveIconProps } from "./types";

	let { direction }: IngredientMoveIconProps = $props();
</script>

<span class="ingredient-move-icon" data-direction={direction}>
	<Chevron {direction} />
</span>

<style lang="scss">
	@use "./IngredientMoveIcon.scss";
</style>
