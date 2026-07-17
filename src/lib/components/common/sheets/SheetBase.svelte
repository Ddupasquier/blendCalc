<script lang="ts">
	import { cubicOut } from "svelte/easing";
	import { fade, fly } from "svelte/transition";
	import type { SheetBaseProps } from "$lib/components/common/sheets/types";
	import {
		manageDialogFocus,
		trapDialogFocus,
	} from "$lib/utils/accessibility/dialogFocus";

	let {
		open = false,
		placement,
		label,
		labelledby,
		modal = true,
		backdrop = true,
		closeOnBackdrop = true,
		aboveNav = true,
		fill = false,
		comfortable = false,
		className = "",
		panelClass = "",
		children,
		onClose = () => {},
	}: SheetBaseProps = $props();
	let sheetElement = $state<HTMLDivElement | null>(null);

	const handleWindowKeydown = (event: KeyboardEvent) => {
		if (!open || event.key !== "Escape" || event.defaultPrevented) return;
		event.preventDefault();
		onClose();
	};

	const handleDialogKeydown = (event: KeyboardEvent) => {
		if (event.key === "Escape") {
			event.preventDefault();
			event.stopPropagation();
			onClose();
			return;
		}
		if (modal && sheetElement) trapDialogFocus(event, sheetElement);
	};

	$effect(() => {
		if (!open || !sheetElement) return;
		return manageDialogFocus(sheetElement);
	});

	const transitionOptions = $derived(
		placement === "right"
			? { x: "100%", duration: 240, easing: cubicOut }
			: { y: "100%", duration: 260, easing: cubicOut },
	);
</script>

<svelte:window onkeydown={handleWindowKeydown} />

{#if open}
	{#if backdrop}
		<div
			class="sheet-base__backdrop"
			class:sheet-base__backdrop--full-viewport={!aboveNav}
			role="presentation"
			onclick={closeOnBackdrop ? onClose : undefined}
			transition:fade={{ duration: 180 }}
		></div>
	{/if}

	<div
		bind:this={sheetElement}
		class={[
			"sheet-base",
			`sheet-base--${placement}`,
			!aboveNav ? "sheet-base--full-viewport" : "",
			fill ? "sheet-base--fill" : "",
			comfortable ? "sheet-base--comfortable" : "",
			className,
		]
			.filter(Boolean)
			.join(" ")}
		role="dialog"
		aria-modal={modal ? "true" : undefined}
		aria-label={labelledby ? undefined : label}
		aria-labelledby={labelledby}
		tabindex="-1"
		onclick={(event) => event.stopPropagation()}
		onkeydown={handleDialogKeydown}
	>
		<div
			class={[
				"sheet-base__panel",
				`sheet-base__panel--${placement}`,
				panelClass,
			]
				.filter(Boolean)
				.join(" ")}
			transition:fly={transitionOptions}
		>
			{@render children()}
		</div>
	</div>
{/if}

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.sheet-base__backdrop,
	.sheet-base {
		--sheet-top-offset: #{$app-shell-header-height};
		--sheet-bottom-offset: calc(
			#{$app-shell-nav-height} + env(safe-area-inset-bottom)
		);
		--sheet-shell-side: max(
			0rem,
			calc((100vw - #{$app-shell-content-max-width}) / 2)
		);
	}

	.sheet-base__backdrop {
		position: fixed;
		top: var(--sheet-top-offset);
		right: 0;
		bottom: var(--sheet-bottom-offset);
		left: 0;
		z-index: $app-sheet-backdrop-z-index;
		background: $app-shell-overlay-bg;
	}

	.sheet-base__backdrop--full-viewport,
	.sheet-base--full-viewport {
		--sheet-bottom-offset: 0rem;
	}

	.sheet-base {
		position: fixed;
		box-sizing: border-box;
		pointer-events: auto;
		isolation: isolate;
		overflow: hidden;
	}

	.sheet-base--bottom {
		right: var(--sheet-shell-side);
		bottom: var(--sheet-bottom-offset);
		left: var(--sheet-shell-side);
		z-index: $app-sheet-panel-z-index;
		display: flex;
		align-items: end;
	}

	.sheet-base--right {
		inset: var(--sheet-top-offset) 0 var(--sheet-bottom-offset);
		z-index: $app-right-sheet-z-index;
		display: grid;
		justify-items: center;
		background: $app-shell-surface-page;
	}

	.sheet-base__panel {
		width: 100%;
		min-width: 0;
		min-height: 0;
		box-sizing: border-box;
		background: $app-shell-surface-panel;
	}

	.sheet-base__panel--bottom {
		display: flex;
		flex-direction: column;
		width: 100%;
		min-height: min(
			$app-bottom-sheet-min-height-fallback,
			calc(100vh - var(--sheet-top-offset) - var(--sheet-bottom-offset))
		);
		min-height: min(
			$app-bottom-sheet-min-height,
			calc(100dvh - var(--sheet-top-offset) - var(--sheet-bottom-offset))
		);
		max-height: min(
			$app-bottom-sheet-max-height-fallback,
			calc(100vh - var(--sheet-top-offset) - var(--sheet-bottom-offset))
		);
		max-height: min(
			$app-bottom-sheet-max-height,
			calc(100dvh - var(--sheet-top-offset) - var(--sheet-bottom-offset))
		);
		padding: $app-gap-sm $app-shell-padding-x $app-gap-md;
		overflow: hidden;
		border-radius: $app-sheet-radius $app-sheet-radius 0 0;
	}

	.sheet-base--fill .sheet-base__panel--bottom {
		height: min(
			$app-bottom-sheet-max-height-fallback,
			calc(100vh - var(--sheet-top-offset) - var(--sheet-bottom-offset))
		);
		height: min(
			$app-bottom-sheet-max-height,
			calc(100dvh - var(--sheet-top-offset) - var(--sheet-bottom-offset))
		);
	}

	.sheet-base--comfortable .sheet-base__panel--bottom {
		min-height: min(
			$app-bottom-sheet-comfortable-min-height,
			calc(100vh - var(--sheet-top-offset) - var(--sheet-bottom-offset))
		);
		min-height: min(
			$app-bottom-sheet-comfortable-min-height,
			calc(100dvh - var(--sheet-top-offset) - var(--sheet-bottom-offset))
		);
	}

	.sheet-base__panel--right {
		width: 100%;
		max-width: $app-shell-content-max-width;
		height: 100%;
		padding: $app-shell-padding-y $app-shell-padding-x 0;
		overflow-y: auto;
		background: $app-shell-surface-page;
		overscroll-behavior: contain;
		-webkit-overflow-scrolling: touch;
	}
</style>
