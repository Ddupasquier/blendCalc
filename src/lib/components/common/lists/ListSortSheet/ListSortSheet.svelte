<script lang="ts">
	import ActionButton from "$lib/components/common/buttons/ActionButton/ActionButton.svelte";
	import PillButton from "$lib/components/common/buttons/PillButton/PillButton.svelte";
	import BottomSheet from "$lib/components/common/sheets/BottomSheet/BottomSheet.svelte";
	import type { ListSortSheetProps } from "./types";

	let {
		open,
		value,
		options,
		filterValue,
		filterOptions = [],
		filterTitle = "Show",
		label,
		title = "Sort",
		titleId,
		loading = false,
		onApply,
		onClose,
	}: ListSortSheetProps = $props();

	let draftValue = $state("");
	let draftFilterValue = $state("");
	const hasFilterOptions = $derived(filterOptions.length > 0);

	$effect(() => {
		if (!open) return;
		draftValue = value;
		draftFilterValue = filterValue ?? "";
	});

	const applyControls = () => {
		if (hasFilterOptions) {
			onApply(draftValue, draftFilterValue);
			return;
		}
		onApply(draftValue);
	};
</script>

<BottomSheet {open} {title} {titleId} {label} onClose={onClose}>
	<div class="list-sort-sheet">
		{#if hasFilterOptions}
			<section class="list-sort-sheet__section" aria-labelledby={`${titleId}-filters`}>
				<h3 id={`${titleId}-filters`}>{filterTitle}</h3>
				<div
					class="list-sort-sheet__options"
					role="group"
					aria-labelledby={`${titleId}-filters`}
				>
					{#each filterOptions as option (option.value)}
						<PillButton
							variant={draftFilterValue === option.value ? "primary" : "neutral"}
							pressed={draftFilterValue === option.value}
							onclick={() => (draftFilterValue = option.value)}
						>
							{option.label}
						</PillButton>
					{/each}
				</div>
			</section>
		{/if}

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
			onclick={applyControls}
		>
			Apply
		</ActionButton>
	</div>
</BottomSheet>

<style lang="scss">
	@use "./ListSortSheet.scss";
</style>
