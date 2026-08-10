<script lang="ts">
	import { goto } from "$app/navigation";
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
	let pendingVisualIndex = $state<number | null>(null);
	const visualActiveIndex = $derived(pendingVisualIndex ?? activeIndex);
	let motionSequence = $state(0);
	let motionDirection = $state<"backward" | "forward">("forward");
	let pendingNavigation = $state<{ href: string; index: number } | null>(null);

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

		nextTab?.click();
	};

	const isActive = (option: SegmentedControlOption) => value === option.value;
	const isVisuallyActive = (
		option: SegmentedControlOption,
		index: number,
	) => variant === "pill" && options.length === 2
		? visualActiveIndex === index
		: isActive(option);

	const handleLinkClick = (
		event: MouseEvent,
		option: SegmentedControlOption,
		index: number,
	) => {
		const link = event.currentTarget as HTMLAnchorElement;
		const shouldUseNativeNavigation =
			event.defaultPrevented ||
			event.button !== 0 ||
			event.metaKey ||
			event.ctrlKey ||
			event.shiftKey ||
			event.altKey ||
			(link.target !== "" && link.target !== "_self");
		if (shouldUseNativeNavigation) return;
		if (variant !== "pill" || options.length !== 2 || !option.href) return;

		event.preventDefault();
		if (pendingNavigation?.index === index) return;

		motionDirection = index > visualActiveIndex ? "forward" : "backward";
		pendingVisualIndex = index === activeIndex ? null : index;
		motionSequence += 1;
		pendingNavigation = index === activeIndex
			? null
			: { href: option.href, index };
	};

	const handleButtonClick = (
		option: SegmentedControlOption,
		index: number,
	) => {
		if (variant !== "pill" || options.length !== 2) {
			onSelect?.(option.value);
			return;
		}
		if (index === visualActiveIndex) return;

		motionDirection = index > visualActiveIndex ? "forward" : "backward";
		pendingVisualIndex = index;
		motionSequence += 1;
		onSelect?.(option.value);
	};

	const handleSelectionAnimationEnd = (event: AnimationEvent) => {
		if (
			event.currentTarget !== event.target
		) return;
		if (!pendingNavigation) {
			pendingVisualIndex = null;
			return;
		}

		const { href } = pendingNavigation;
		pendingNavigation = null;
		void goto(href, {
			keepFocus: true,
			noScroll: true,
		})
			.then(() => {
				pendingVisualIndex = null;
			})
			.catch(() => {
				pendingVisualIndex = null;
			});
	};
</script>

<div
	class="segmented-control"
	role="tablist"
	aria-label={label}
	data-variant={variant}
	data-option-count={options.length}
	data-active-index={Math.max(visualActiveIndex, 0)}
>
	{#if variant === "pill" && options.length === 2}
		<span
			class="segmented-control__selection"
			class:segmented-control__selection--moving={motionSequence > 0}
			class:segmented-control__selection--backward={motionDirection === "backward"}
			aria-hidden="true"
			onanimationend={handleSelectionAnimationEnd}
		>
			{#key motionSequence}
				<span
					class="segmented-control__selection-surface"
					class:segmented-control__selection-surface--moving={motionSequence > 0}
					class:segmented-control__selection-surface--backward={motionDirection === "backward"}
				></span>
			{/key}
		</span>
	{/if}

	{#each options as option, index (option.value)}
		{#if option.href}
			<a
				id={option.id}
				href={option.href}
				data-sveltekit-keepfocus
				data-sveltekit-noscroll
				role="tab"
				class="segmented-control__button"
				class:segmented-control__button--active={isVisuallyActive(option, index)}
				aria-selected={isActive(option)}
				aria-current={isActive(option) ? "page" : undefined}
				aria-controls={option.controlsId}
				tabindex={isActive(option) ? 0 : -1}
				onclick={(event) => handleLinkClick(event, option, index)}
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
				onclick={() => handleButtonClick(option, index)}
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
