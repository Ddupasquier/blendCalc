<script lang="ts">
	import Plus from "$lib/assets/icons/Plus.svelte";
	import CircleIconButton from "$lib/components/common/buttons/CircleIconButton/CircleIconButton.svelte";
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
			$app-shell-padding-x,
			calc((100vw - $app-shell-content-max-width) / 2 + $app-shell-padding-x)
		);
		bottom: calc($app-shell-nav-height + $app-gap-md);
		z-index: 12;
	}
</style>
