<script lang="ts">
	import type { SegmentedControlProps } from "$lib/components/common/buttons/types";
	import { getLinearNavigationIndex } from "$lib/utils/accessibility/keyboardNavigation";

	let {
		label,
		options,
		value,
		onSelect,
	}: SegmentedControlProps = $props();

	const handleKeydown = (event: KeyboardEvent, currentIndex: number) => {
		const nextIndex = getLinearNavigationIndex(
			event.key,
			currentIndex,
			options.length,
		);
		if (nextIndex === null) return;

		event.preventDefault();
		onSelect(options[nextIndex].value);
		const currentTab = event.currentTarget as HTMLButtonElement;
		const tabs = currentTab
			.closest("[role='tablist']")
			?.querySelectorAll<HTMLButtonElement>("[role='tab']");
		tabs?.[nextIndex]?.focus({ preventScroll: true });
	};
</script>

<div class="segmented-control" role="tablist" aria-label={label}>
	{#each options as option, index (option.value)}
		<button
			id={option.id}
			type="button"
			role="tab"
			class:segmented-control__button--active={value === option.value}
			aria-selected={value === option.value}
			aria-controls={option.controlsId}
			tabindex={value === option.value ? 0 : -1}
			onclick={() => onSelect(option.value)}
			onkeydown={(event) => handleKeydown(event, index)}
		>
			{option.label}
			{#if option.count !== undefined}
				<span>{option.count}</span>
			{/if}
		</button>
	{/each}
</div>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.segmented-control {
		display: grid;
		grid-auto-columns: minmax(0, 1fr);
		grid-auto-flow: column;
		padding: $app-gap-xs;
		background: $ingredient-surface-control;
		border-radius: $ingredient-radius-sheet;
	}

	button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: $ingredient-control-height;
		color: $ingredient-text-muted;
		background: transparent;
		border: 0;
		border-radius: $ingredient-radius-pill;
		font-family: $app-button-font-family;
		font-size: $app-font-size-md;
		font-weight: $app-button-font-weight;
		line-height: $app-button-line-height;
		transition:
			color 160ms ease,
			background-color 160ms ease;
	}

	button:focus-visible {
		outline: $app-focus-outline;
		outline-offset: $app-focus-outline-offset;
	}

	span {
		display: inline-block;
		min-width: $ingredient-count-badge-min-width;
		margin-left: $app-gap-badge-inline;
		padding: $ingredient-badge-padding-y $ingredient-badge-padding-x;
		color: inherit;
		background: color-mix(in srgb, $ingredient-text-muted 12%, transparent);
		border-radius: $ingredient-radius-pill;
		font-size: $app-font-size-xs;
	}

	.segmented-control__button--active {
		color: $ingredient-text-primary;
		background: $ingredient-surface-card;
	}
</style>
