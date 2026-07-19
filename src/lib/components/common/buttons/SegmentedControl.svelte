<script lang="ts">
	import type { SegmentedControlProps } from "$lib/components/common/buttons/types";
	import { getLinearNavigationIndex } from "$lib/utils/accessibility/keyboardNavigation";

	let {
		label,
		options,
		value,
		variant = "pill",
		onSelect,
	}: SegmentedControlProps = $props();
	const activeIndex = $derived(options.findIndex((option) => option.value === value));

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

<div class="segmented-control" role="tablist" aria-label={label} data-variant={variant}>
	{#each options as option, index (option.value)}
		<button
			id={option.id}
			type="button"
			role="tab"
			class:segmented-control__button--active={value === option.value}
			class:segmented-control__button--completed={variant === "progress" && index <= activeIndex}
			aria-selected={value === option.value}
			aria-current={variant === "progress" && value === option.value ? "step" : undefined}
			aria-controls={option.controlsId}
			tabindex={value === option.value ? 0 : -1}
			onclick={() => onSelect(option.value)}
			onkeydown={(event) => handleKeydown(event, index)}
		>
			{#if variant === "progress"}
				<span class="segmented-control__progress-indicator" aria-hidden="true"></span>
			{/if}
			<span class="segmented-control__label">{option.label}</span>
			{#if option.count !== undefined}
				<span class="segmented-control__count">{option.count}</span>
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
	}

	.segmented-control[data-variant="pill"] {
		padding: $app-gap-xs;
		background: $ingredient-surface-control;
		border-radius: $ingredient-radius-sheet;
	}

	button {
		min-width: 0;
		color: $ingredient-text-muted;
		background: transparent;
		border: 0;
		font-family: $app-button-font-family;
		line-height: $app-button-line-height;
		cursor: pointer;
		transition:
			color 160ms ease,
			background-color 160ms ease;
	}

	.segmented-control[data-variant="pill"] button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: $ingredient-control-height;
		border-radius: $ingredient-radius-pill;
		font-size: $app-font-size-md;
		font-weight: $app-button-font-weight;
	}

	.segmented-control[data-variant="progress"] {
		gap: $app-gap-xs;
		padding: $app-gap-xs;
	}

	.segmented-control[data-variant="progress"] button {
		display: grid;
		align-items: center;
		gap: $app-gap-xs;
		min-height: $ingredient-control-height;
		padding: 0;
		border-radius: $ingredient-radius-control;
		font-size: $app-font-size-xs;
		font-weight: $app-font-weight-medium;
	}

	button:focus-visible {
		outline: $app-focus-outline;
		outline-offset: $app-focus-outline-offset;
	}

	.segmented-control__label {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.segmented-control__count {
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
	}

	.segmented-control[data-variant="pill"] .segmented-control__button--active {
		background: $ingredient-surface-card;
	}

	.segmented-control__progress-indicator {
		display: block;
		width: 100%;
		height: $app-progress-step-indicator-thickness;
		background: $ingredient-surface-control;
		border-radius: $ingredient-radius-pill;
		transition: background-color 160ms ease;
	}

	.segmented-control__button--completed .segmented-control__progress-indicator {
		background: $ingredient-accent-primary;
	}

	.segmented-control[data-variant="progress"] .segmented-control__button--active {
		color: $ingredient-accent-primary;
	}
</style>
