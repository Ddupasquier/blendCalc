<script lang="ts">
	import DotsHorizontal from "$lib/assets/icons/DotsHorizontal.svelte";
	import X from "$lib/assets/icons/X.svelte";
	import CircleIconButton from "$lib/components/common/buttons/CircleIconButton/CircleIconButton.svelte";
	import type { IngredientCardActionsProps } from "./types";

	let {
		description,
		removing = false,
		removeArmed = false,
		removeLabel = `Remove ${description}`,
		removeMessageId = undefined,
		onActions,
		onRemove,
	}: IngredientCardActionsProps = $props();
</script>

<div class="ingredient-card-actions">
	<CircleIconButton
		label={`Open actions for ${description}`}
		variant="soft"
		size="small"
		onclick={onActions}
	>
		<DotsHorizontal size={16} />
	</CircleIconButton>
	<CircleIconButton
		label={removeLabel}
		variant={removeArmed ? "danger" : "soft"}
		size="small"
		busy={removing}
		disabled={removing}
		aria-describedby={removeArmed ? removeMessageId : undefined}
		onclick={onRemove}
	>
		<X size={16} strokeWidth={2.7} />
	</CircleIconButton>
</div>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.ingredient-card-actions {
		display: flex;
		align-items: center;
		gap: $app-gap-sm;
	}
</style>
