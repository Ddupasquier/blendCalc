<script lang="ts">
	import Plus from "$lib/assets/icons/Plus/Plus.svelte";
	import CircleIconButton from "$lib/components/common/buttons/CircleIconButton/CircleIconButton.svelte";
	import type { IngredientsFloatingAddButtonProps } from "./types";

	let {
		onClick,
	}: IngredientsFloatingAddButtonProps = $props();
</script>

<div class="add-ingredient-fab">
	<CircleIconButton
		label="Add ingredient manually"
		variant="primary"
		size="fab"
		onclick={onClick}
	>
		<Plus size={28} strokeWidth={2.4} />
	</CircleIconButton>
</div>

<style lang="scss">
	@use "./IngredientsFloatingAddButton.scss";
</style>
