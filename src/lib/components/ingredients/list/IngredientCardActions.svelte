<script lang="ts">
	import DotsHorizontal from "$lib/assets/icons/DotsHorizontal.svelte";
	import X from "$lib/assets/icons/X.svelte";
	import CircleIconButton from "$lib/components/common/buttons/CircleIconButton.svelte";

	let {
		description,
		removing = false,
		onActions,
		onRemove,
	}: {
		description: string;
		removing?: boolean;
		onActions: () => void;
		onRemove: () => void;
	} = $props();
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
		label={`Remove ${description}`}
		variant="soft"
		size="small"
		busy={removing}
		disabled={removing}
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
		gap: $app-gap-xs;
	}
</style>
