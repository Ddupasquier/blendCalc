<script lang="ts">
	import type {
		SegmentedControlOption,
		SegmentedControlProps,
	} from "./types";
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
		const currentTab = event.currentTarget as HTMLButtonElement;
		const tabs = currentTab
			.closest("[role='tablist']")
			?.querySelectorAll<HTMLElement>("[role='tab']");
		const nextTab = tabs?.[nextIndex];
		nextTab?.focus({ preventScroll: true });

		if (options[nextIndex].href) {
			nextTab?.click();
			return;
		}

		onSelect?.(options[nextIndex].value);
	};

	const isActive = (option: SegmentedControlOption) => value === option.value;
</script>

<div class="segmented-control" role="tablist" aria-label={label} data-variant={variant}>
	{#each options as option, index (option.value)}
		{#if option.href}
			<a
				id={option.id}
				href={option.href}
				data-sveltekit-keepfocus
				data-sveltekit-noscroll
				role="tab"
				class="segmented-control__button"
				class:segmented-control__button--active={isActive(option)}
				aria-selected={isActive(option)}
				aria-current={isActive(option) ? "page" : undefined}
				aria-controls={option.controlsId}
				tabindex={isActive(option) ? 0 : -1}
				onkeydown={(event) => handleKeydown(event, index)}
			>
				<span class="segmented-control__label">{option.label}</span>
				{#if option.count !== undefined}
					<span class="segmented-control__count">{option.count}</span>
				{/if}
			</a>
		{:else}
			<button
				id={option.id}
				type="button"
				role="tab"
				class="segmented-control__button"
				class:segmented-control__button--active={isActive(option)}
				class:segmented-control__button--completed={variant === "progress" && index <= activeIndex}
				aria-selected={isActive(option)}
				aria-current={variant === "progress" && isActive(option) ? "step" : undefined}
				aria-controls={option.controlsId}
				tabindex={isActive(option) ? 0 : -1}
				onclick={() => onSelect?.(option.value)}
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
		{/if}
	{/each}
</div>

<style lang="scss">
	@use "./SegmentedControl.scss";
</style>
