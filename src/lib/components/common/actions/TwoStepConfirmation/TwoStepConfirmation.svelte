<script lang="ts">
	import { onDestroy } from "svelte";
	import type { TwoStepConfirmationProps } from "./types";

	const CONFIRMATION_WINDOW_MS = 5000;

	let {
		actionLabel,
		confirmationLabel,
		message,
		messageId,
		disabled = false,
		onConfirm,
		children,
	}: TwoStepConfirmationProps = $props();

	let armed = $state(false);
	let confirmationTimer: ReturnType<typeof setTimeout> | null = null;
	let armingEvent: Event | null = null;

	const clearTimer = () => {
		if (confirmationTimer === null) return;
		clearTimeout(confirmationTimer);
		confirmationTimer = null;
	};

	const disarm = () => {
		clearTimer();
		armed = false;
		armingEvent = null;
	};

	const activate = (event?: Event) => {
		if (disabled) return;

		if (armed) {
			if (event && event === armingEvent) return;
			disarm();
			onConfirm();
			return;
		}

		armed = true;
		armingEvent = event ?? null;
		clearTimer();
		confirmationTimer = setTimeout(disarm, CONFIRMATION_WINDOW_MS);
	};

	$effect(() => {
		if (disabled) disarm();
	});

	onDestroy(clearTimer);
</script>

<span class="two-step-confirmation">
	{@render children({
		armed,
		activate,
		label: armed ? confirmationLabel : actionLabel,
		messageId,
	})}
	{#if armed}
		<span
			id={messageId}
			class="two-step-confirmation__message"
			role="status"
			aria-live="polite"
		>
			{message}
		</span>
	{/if}
</span>

<style lang="scss">
	@use "./TwoStepConfirmation.scss";
</style>
