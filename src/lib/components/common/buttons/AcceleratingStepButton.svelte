<script lang="ts">
	import { onDestroy } from "svelte";
	import CircleIconButton from "$lib/components/common/buttons/CircleIconButton.svelte";
	import type { AcceleratingStepButtonProps } from "$lib/components/common/buttons/types";
	import {
		ACCELERATING_STEP_HOLD_DELAY_MS,
		ACCELERATING_STEP_REPEAT_MS,
		getAcceleratingStep,
	} from "$lib/utils/interaction/acceleratingStep";

	let {
		label,
		variant = "primary",
		size = "small",
		disabled = false,
		onStep,
		children,
	}: AcceleratingStepButtonProps = $props();

	let holdTimer: ReturnType<typeof setTimeout> | null = null;
	let repeatTimer: ReturnType<typeof setTimeout> | null = null;
	let suppressClickTimer: ReturnType<typeof setTimeout> | null = null;
	let pressStartedAt = 0;
	let pressing = false;
	let suppressNextClick = false;

	const clearTimer = (timer: ReturnType<typeof setTimeout> | null) => {
		if (timer !== null) clearTimeout(timer);
	};

	const stopPress = () => {
		pressing = false;
		clearTimer(holdTimer);
		clearTimer(repeatTimer);
		holdTimer = null;
		repeatTimer = null;
	};

	const repeatStep = () => {
		if (!pressing || disabled) return;
		onStep(getAcceleratingStep(Date.now() - pressStartedAt));
		repeatTimer = setTimeout(repeatStep, ACCELERATING_STEP_REPEAT_MS);
	};

	const startPress = () => {
		if (pressing || disabled) return;
		pressing = true;
		pressStartedAt = Date.now();
		onStep(1);
		holdTimer = setTimeout(repeatStep, ACCELERATING_STEP_HOLD_DELAY_MS);
	};

	const releaseClickSuppression = () => {
		clearTimer(suppressClickTimer);
		suppressClickTimer = setTimeout(() => {
			suppressNextClick = false;
			suppressClickTimer = null;
		}, 0);
	};

	const handlePointerDown = (event: PointerEvent) => {
		if (event.pointerType === "mouse" && event.button !== 0) return;
		event.preventDefault();
		const button = event.currentTarget as HTMLButtonElement;
		button.focus({ preventScroll: true });
		button.setPointerCapture?.(event.pointerId);
		suppressNextClick = true;
		startPress();
	};

	const handlePointerUp = (event: PointerEvent) => {
		event.preventDefault();
		stopPress();
		const button = event.currentTarget as HTMLButtonElement;
		if (button.hasPointerCapture?.(event.pointerId)) {
			button.releasePointerCapture(event.pointerId);
		}
		releaseClickSuppression();
	};

	const handlePointerCancel = () => {
		stopPress();
		suppressNextClick = false;
	};

	const handleKeydown = (event: KeyboardEvent) => {
		if ((event.key !== "Enter" && event.key !== " ") || event.repeat) return;
		event.preventDefault();
		suppressNextClick = true;
		startPress();
	};

	const handleKeyup = (event: KeyboardEvent) => {
		if (event.key !== "Enter" && event.key !== " ") return;
		event.preventDefault();
		stopPress();
		releaseClickSuppression();
	};

	const handleClick = (event: MouseEvent) => {
		if (suppressNextClick) {
			event.preventDefault();
			return;
		}
		onStep(1);
	};

	$effect(() => {
		if (disabled) stopPress();
	});

	onDestroy(() => {
		stopPress();
		clearTimer(suppressClickTimer);
	});
</script>

<CircleIconButton
	{label}
	{variant}
	{size}
	{disabled}
	onclick={handleClick}
	onkeydown={handleKeydown}
	onkeyup={handleKeyup}
	onpointerdown={handlePointerDown}
	onpointerup={handlePointerUp}
	onpointercancel={handlePointerCancel}
	onlostpointercapture={stopPress}
	oncontextmenu={(event) => event.preventDefault()}
>
	{@render children?.()}
</CircleIconButton>
