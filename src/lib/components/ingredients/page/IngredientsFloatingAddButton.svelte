<script lang="ts">
	import Plus from "$lib/assets/icons/Plus.svelte";
	import CircleIconButton from "$lib/components/common/buttons/CircleIconButton.svelte";
	import type { IngredientsFloatingAddButtonProps } from "$lib/components/ingredients/page/types";

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
	@use "../../../../styles/variables" as *;

	.add-ingredient-fab {
		position: fixed;
		right: max(
			$ingredient-shell-padding-x,
			calc((100vw - $ingredient-shell-max-width) / 2 + $ingredient-shell-padding-x)
		);
		bottom: calc($ingredient-shell-nav-height + $app-gap-md);
		z-index: 12;
	}
</style>
