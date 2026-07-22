<script lang="ts">
	import type { SegmentedControlProps } from "./types";
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
	@use "./SegmentedControl.scss";
</style>
