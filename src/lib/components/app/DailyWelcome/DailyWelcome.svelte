<script lang="ts">
	import { onMount } from "svelte";
	import { cubicOut } from "svelte/easing";
	import { fly } from "svelte/transition";
	import { shouldShowDailyWelcome } from "$lib/utils/storage/client/dailyWelcome";
	import { getMotionSafeDuration } from "$lib/utils/accessibility/motion";
	import type { DailyWelcomeProps } from "./types";

	const WELCOME_DURATION_MS = 4_000;

	let {
		userId,
		name,
	}: DailyWelcomeProps = $props();

	let visible = $state(false);
	let dismissTimer: ReturnType<typeof setTimeout> | null = null;

	const dismiss = () => {
		visible = false;

		if (dismissTimer) {
			clearTimeout(dismissTimer);
			dismissTimer = null;
		}
	};

	onMount(() => {
		if (!shouldShowDailyWelcome(window.localStorage, userId)) return;

		visible = true;
		dismissTimer = setTimeout(dismiss, WELCOME_DURATION_MS);

		return dismiss;
	});
</script>

<div class="daily-welcome-region" aria-live="polite" aria-atomic="true">
	{#if visible}
		<button
			class="daily-welcome"
			type="button"
			onclick={dismiss}
			aria-label={`Dismiss welcome message for ${name}`}
			transition:fly={{
				y: 12,
				duration: getMotionSafeDuration(180),
				easing: cubicOut,
			}}
		>
			<span class="daily-welcome__eyebrow">Welcome back,</span>
			<strong>{name}</strong>
			<span class="daily-welcome__hint">Tap to dismiss</span>
			<span class="daily-welcome__timer" aria-hidden="true"></span>
		</button>
	{/if}
</div>

<style lang="scss">
	@use "./DailyWelcome.scss";
</style>
