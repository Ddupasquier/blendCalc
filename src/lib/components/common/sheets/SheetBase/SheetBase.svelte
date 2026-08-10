<script lang="ts">
	import { fade, fly } from "svelte/transition";
	import type { SheetBaseProps } from "./types";
	import {
		DIALOG_FOCUSABLE_SELECTOR,
		manageDialogFocus,
		trapDialogFocus,
	} from "$lib/utils/accessibility/dialogFocus";
	import { createBackdropDismissal } from "$lib/utils/accessibility/backdropDismissal";
	import {
		getMotionSafeDuration,
		MOTION_DURATION_MS,
	} from "$lib/utils/animation/motion";
	import { MOTION_EASING_FUNCTION } from "$lib/utils/animation/transitions";

	let {
		id,
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
	let returnFocusTarget: HTMLElement | null = null;
	let wasOpen = false;

	const handleWindowKeydown = (event: KeyboardEvent) => {
		if (!open || event.key !== "Escape" || event.defaultPrevented) return;
		event.preventDefault();
		onClose();
	};

	const rememberReturnFocusTarget = (event: FocusEvent) => {
		if (open || !(event.target instanceof HTMLElement)) return;
		returnFocusTarget = event.target;
	};

	const rememberInteractionTarget = (event: Event) => {
		if (!(event.target instanceof Element)) return;
		if (sheetElement?.contains(event.target)) return;
		const focusableTarget = event.target.closest(DIALOG_FOCUSABLE_SELECTOR);
		returnFocusTarget =
			focusableTarget instanceof HTMLElement ? focusableTarget : null;
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

	const backdropDismissal = createBackdropDismissal({
		canDismiss: () => open && closeOnBackdrop,
		onDismiss: () => onClose(),
	});

	$effect.pre(() => {
		if (open && !wasOpen) {
			const activeElement = document.activeElement;
			if (
				activeElement instanceof HTMLElement &&
				activeElement !== document.body &&
				activeElement !== document.documentElement
			) {
				returnFocusTarget = activeElement;
			}
		}
		wasOpen = open;
	});

	$effect(() => {
		if (!open || !sheetElement) return;
		return manageDialogFocus(sheetElement, returnFocusTarget);
	});

	const transitionOptions = $derived(
		placement === "right"
			? {
					x: "100%",
					duration: getMotionSafeDuration(MOTION_DURATION_MS.sheetRight),
					easing: MOTION_EASING_FUNCTION.spatial,
				}
			: {
					y: "100%",
					duration: getMotionSafeDuration(MOTION_DURATION_MS.sheetBottom),
					easing: MOTION_EASING_FUNCTION.spatial,
				},
	);
</script>

<svelte:window
	onblur={backdropDismissal.handleWindowBlur}
	onclick={rememberInteractionTarget}
	onfocusin={rememberReturnFocusTarget}
	onkeydown={handleWindowKeydown}
	onpointerdown={rememberInteractionTarget}
/>

{#if open}
	{#if backdrop}
		<div
			class="sheet-base__backdrop"
			class:sheet-base__backdrop--full-viewport={!aboveNav}
			role="presentation"
			onpointercancel={backdropDismissal.handleBackdropPointerCancel}
			onpointerdown={backdropDismissal.handleBackdropPointerDown}
			onpointerup={backdropDismissal.handleBackdropPointerUp}
			transition:fade={{
				duration: getMotionSafeDuration(MOTION_DURATION_MS.feedback),
			}}
		></div>
	{/if}

	<div
		{id}
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
		onpointerdown={backdropDismissal.handleSheetPointerDown}
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
	@use "./SheetBase.scss";
</style>
