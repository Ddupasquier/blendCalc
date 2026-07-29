<script lang="ts">
	import ActionButton from "$lib/components/common/buttons/ActionButton/ActionButton.svelte";
	import PillButton from "$lib/components/common/buttons/PillButton/PillButton.svelte";
	import BottomSheet from "$lib/components/common/sheets/BottomSheet/BottomSheet.svelte";
	import type { ListSortSheetProps } from "./types";

	let {
		open,
		value,
		options,
		label,
		title = "Sort",
		titleId,
		loading = false,
		onApply,
		onClose,
	}: ListSortSheetProps = $props();

	let draftValue = $state("");

	$effect(() => {
		if (!open) return;
		draftValue = value;
	});
</script>

<BottomSheet {open} {title} {titleId} {label} onClose={onClose}>
	<div class="list-sort-sheet">
		<section class="list-sort-sheet__section" aria-labelledby={`${titleId}-options`}>
			<h3 id={`${titleId}-options`}>Sort</h3>
			<div
				class="list-sort-sheet__options"
				role="group"
				aria-labelledby={`${titleId}-options`}
			>
				{#each options as option (option.value)}
					<PillButton
						variant={draftValue === option.value ? "primary" : "neutral"}
						pressed={draftValue === option.value}
						onclick={() => (draftValue = option.value)}
					>
						{option.label}
					</PillButton>
				{/each}
			</div>
		</section>

		<ActionButton
			fullWidth
			variant="success"
			busy={loading}
			onclick={() => onApply(draftValue)}
		>
			Apply
		</ActionButton>
	</div>
</BottomSheet>

<style lang="scss">
	@use "./ListSortSheet.scss";
</style>
