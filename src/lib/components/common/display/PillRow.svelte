<script lang="ts">
    import Pill from "./Pill.svelte";
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
    } = $props<{
        pills: string[];
        onRemove?: (idx: number) => void;
		onRename?: (idx: number) => void;
        onSelect?: (idx: number) => void;
		removable?: boolean;
        activeIndices?: number[];
        customIndices?: number[];
		disabledIndices?: number[];
		preserveOrder?: boolean;
    }>();

    type ArrangedPill = {
        label: string;
        index: number;
        active: boolean;
        custom: boolean;
    };

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
    @use "../../../../styles/variables" as *;

    .pill-row {
        display: flex;
        flex-wrap: wrap;
        gap: $app-gap-sm;
        margin: $app-gap-sm 0 0.2em 0;
    }
</style>
