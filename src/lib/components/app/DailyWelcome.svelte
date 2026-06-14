<script lang="ts">
	import { onMount } from "svelte";
	import { shouldShowDailyWelcome } from "$lib/utils/storage/dailyWelcome";

	const WELCOME_DURATION_MS = 4_000;

	let {
		userId,
		name,
	}: {
		userId: string;
		name: string;
	} = $props();

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
		>
			<span class="daily-welcome__eyebrow">Welcome back,</span>
			<strong>{name}</strong>
			<span class="daily-welcome__hint">Tap to dismiss</span>
			<span class="daily-welcome__timer" aria-hidden="true"></span>
		</button>
	{/if}
</div>

<style lang="scss">
	@use "../../../styles/variables" as *;

	.daily-welcome-region {
		position: fixed;
		right: $app-gap-md;
		bottom: $app-gap-md;
		z-index: 200;
		pointer-events: none;
	}

	.daily-welcome {
		position: relative;
		display: grid;
		gap: $app-gap-xs;
		width: min(22rem, calc(100vw - 2 * $app-gap-md));
		padding: 0.9rem 1rem 0.8rem;
		overflow: hidden;
		text-align: left;
		color: $app-primary;
		background: $app-section-bg;
		border: $app-border;
		border-radius: $app-card-radius;
		box-shadow: 0 0.8rem 2rem rgb(79 72 66 / 18%);
		cursor: pointer;
		pointer-events: auto;
		animation: welcome-enter 180ms ease-out both;

		strong {
			font-family: $app-display-font-family;
			font-size: $app-font-size-xl;
			line-height: 1.2;
			overflow-wrap: anywhere;
		}

		&:focus-visible {
			outline: $app-focus-outline;
			outline-offset: 3px;
		}
	}

	.daily-welcome__eyebrow {
		font-size: $app-font-size-sm;
		font-weight: 750;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.daily-welcome__hint {
		color: $app-muted;
		font-size: $app-font-size-xs;
	}

	.daily-welcome__timer {
		position: absolute;
		left: 0;
		bottom: 0;
		width: 100%;
		height: 0.22rem;
		background: $app-highlight;
		transform-origin: left;
		animation: welcome-timer 4s linear forwards;
	}

	@keyframes welcome-enter {
		from {
			opacity: 0;
			transform: translateY(0.75rem);
		}

		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes welcome-timer {
		to {
			transform: scaleX(0);
		}
	}

	@media (max-width: $app-breakpoint-sm) {
		.daily-welcome-region {
			right: 50%;
			bottom: $app-gap-sm;
			transform: translateX(50%);
		}

		.daily-welcome {
			width: min(22rem, calc(100vw - 2 * $app-gap-sm));
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.daily-welcome,
		.daily-welcome__timer {
			animation: none;
		}
	}
</style>
