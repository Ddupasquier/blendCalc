<script lang="ts">
	import Check from "$lib/assets/icons/Check.svelte";
	import CircleIconButton from "$lib/components/common/buttons/CircleIconButton.svelte";

	let {
		checked = false,
		label,
		onToggle,
	}: {
		checked?: boolean;
		label: string;
		onToggle: () => void;
	} = $props();
</script>

<CircleIconButton
	{label}
	variant={checked ? "primary" : "outline"}
	size="small"
	pressed={checked}
	class="ingredient-bulk-toggle"
	onclick={onToggle}
>
	{#if checked}<Check size="1em" strokeWidth={3} />{/if}
</CircleIconButton>
