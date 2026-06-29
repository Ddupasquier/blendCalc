<script lang="ts">
	import { fade, fly } from "svelte/transition";
	import { cubicOut } from "svelte/easing";
	import type { Snippet } from "svelte";

	let {
		open,
		title,
		titleId = "bottom-sheet-title",
		label = title,
		aboveNav = true,
		fill = false,
		comfortable = false,
		titleStyle = "compact",
		children,
		onClose,
	}: {
		open: boolean;
		title?: string;
		titleId?: string;
		label?: string;
		aboveNav?: boolean;
		fill?: boolean;
		comfortable?: boolean;
		titleStyle?: "compact" | "prominent";
		children: Snippet;
		onClose: () => void;
	} = $props();

	const handleKeydown = (event: KeyboardEvent) => {
		if (open && event.key === "Escape") {
			onClose();
		}
	};
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<div
		class="bottom-sheet-backdrop"
		class:bottom-sheet-backdrop--full-viewport={!aboveNav}
		role="presentation"
		onclick={onClose}
		transition:fade={{ duration: 180 }}
	></div>

	<div
		class="bottom-sheet"
		class:bottom-sheet--full-viewport={!aboveNav}
		class:bottom-sheet--fill={fill}
		class:bottom-sheet--comfortable={comfortable}
		class:bottom-sheet--prominent-title={titleStyle === "prominent"}
		role="dialog"
		aria-modal="true"
		aria-label={title ? undefined : label}
		aria-labelledby={title ? titleId : undefined}
		tabindex="-1"
		onclick={(event) => event.stopPropagation()}
		onkeydown={(event) => event.stopPropagation()}
		transition:fly={{ y: "100%", duration: 260, easing: cubicOut }}
	>
		<button class="bottom-sheet__dismiss" type="button" aria-label="Close sheet" onclick={onClose}>
			<span aria-hidden="true"></span>
		</button>
		{#if title}
			<h2 id={titleId}>{title}</h2>
		{/if}
		<div class="bottom-sheet__content">
			{@render children()}
		</div>
	</div>
{/if}

<style lang="scss">
	@use "../../../styles/variables" as *;

	.bottom-sheet-backdrop,
	.bottom-sheet {
		--bottom-sheet-top-offset: #{$app-shell-header-height};
		--bottom-sheet-bottom-offset: calc(
			#{$app-shell-nav-height} + env(safe-area-inset-bottom)
		);
		--bottom-sheet-shell-side: max(
			0rem,
			calc((100vw - #{$app-shell-content-max-width}) / 2)
		);
	}

	.bottom-sheet-backdrop {
		position: fixed;
		top: var(--bottom-sheet-top-offset);
		right: 0;
		bottom: var(--bottom-sheet-bottom-offset);
		left: 0;
		z-index: 110;
		padding: 0;
		background: $app-shell-overlay-bg;
	}

	.bottom-sheet-backdrop--full-viewport,
	.bottom-sheet--full-viewport {
		--bottom-sheet-bottom-offset: 0rem;
	}

	.bottom-sheet {
		position: fixed;
		right: var(--bottom-sheet-shell-side);
		bottom: var(--bottom-sheet-bottom-offset);
		left: var(--bottom-sheet-shell-side);
		z-index: 111;
		display: flex;
		flex-direction: column;
		gap: $app-gap-md;
		width: auto;
		min-height: min(
			$app-bottom-sheet-min-height,
			calc(
				100dvh - var(--bottom-sheet-top-offset) -
					var(--bottom-sheet-bottom-offset)
			)
		);
		max-height: min(
			$app-bottom-sheet-max-height,
			calc(
				100dvh - var(--bottom-sheet-top-offset) -
					var(--bottom-sheet-bottom-offset)
			)
		);
		padding: $app-gap-sm $app-shell-padding-x $app-gap-md;
		margin: 0;
		overflow: hidden;
		background: $app-shell-surface-panel;
		border-radius: $app-sheet-radius $app-sheet-radius 0 0;

		h2 {
			margin: 0;
			overflow: hidden;
			color: $app-shell-text-muted;
			font-size: $app-font-size-md;
			font-weight: $app-font-weight-bold;
			line-height: 1.2;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
	}

	.bottom-sheet--prominent-title {
		h2 {
			color: $app-shell-text-primary;
			font-size: $app-font-size-xl;
		}
	}

	.bottom-sheet--fill {
		height: min(
			$app-bottom-sheet-max-height,
			calc(
				100dvh - var(--bottom-sheet-top-offset) -
					var(--bottom-sheet-bottom-offset)
			)
		);
	}

	.bottom-sheet--comfortable {
		min-height: min(
			$app-bottom-sheet-comfortable-min-height,
			calc(
				100dvh - var(--bottom-sheet-top-offset) -
					var(--bottom-sheet-bottom-offset)
			)
		);
	}

	.bottom-sheet__dismiss {
		position: sticky;
		top: 0;
		z-index: 1;
		align-self: center;
		flex: 0 0 auto;
		width: 4rem;
		height: 1.25rem;
		padding: 0;
		background: transparent;
		border: 0;
		border-radius: $app-radius-pill;
		cursor: pointer;

		span {
			display: block;
			width: 2.25rem;
			height: calc($app-gap-xs - 0.05rem);
			margin: 0 auto;
			background: color-mix(in srgb, $app-shell-text-muted 24%, transparent);
			border-radius: $app-radius-pill;
		}

		&:focus-visible {
			outline: $app-focus-outline;
			outline-offset: 0;
		}
	}

	.bottom-sheet__content {
		display: grid;
		align-content: start;
		align-items: start;
		flex: 1 1 auto;
		gap: $app-gap-md;
		grid-auto-rows: max-content;
		min-width: 0;
		min-height: 0;
		padding-bottom: $app-gap-md;
		overflow-y: auto;
		overscroll-behavior: contain;
		-webkit-overflow-scrolling: touch;
	}
</style>
