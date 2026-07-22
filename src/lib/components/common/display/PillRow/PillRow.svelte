<script lang="ts">
	import Pill from "../Pill/Pill.svelte";
	import type { ArrangedPill, PillRowProps } from "./types";
    let {
        pills,
        onRemove,
		onRename,
        onSelect,
		removable = true,
        activeIndices = [],
        customIndices = [],
		disabledIndices = [],
		preserveOrder = false,
	}: PillRowProps = $props();

    const arrangePills = (
        pillLabels: string[],
        selectedIndices: number[],
        userCreatedIndices: number[],
		shouldPreserveOrder: boolean,
    ): ArrangedPill[] => {
        const arranged = pillLabels.map((label, index) => ({
            label,
            index,
            active: selectedIndices.includes(index),
            custom: userCreatedIndices.includes(index),
        }));

		if (shouldPreserveOrder) return arranged;

        return arranged
            .sort((a, b) => {
                if (a.active !== b.active) return a.active ? -1 : 1;
                if (a.label.length !== b.label.length) {
                    return a.label.length - b.label.length;
                }
                return a.label.localeCompare(b.label);
            });
    };

    const arrangedPills = $derived(arrangePills(pills, activeIndices, customIndices, preserveOrder));
</script>

{#if arrangedPills.length > 0}
	<div class="pill-row">
		{#each arrangedPills as pill (`${pill.index}-${pill.label}`)}
			<Pill
				label={pill.label}
				onRemove={onRemove ? () => onRemove(pill.index) : undefined}
				onRename={onRename ? () => onRename(pill.index) : undefined}
				onSelect={() => onSelect && onSelect(pill.index)}
				{removable}
				active={pill.active}
				custom={pill.custom}
				disabled={disabledIndices.includes(pill.index)}
			/>
		{/each}
	</div>
{/if}

<style lang="scss">
	@use "./PillRow.scss";
</style>
