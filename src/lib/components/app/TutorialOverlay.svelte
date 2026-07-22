<script lang="ts">
	import { tick } from "svelte";
	import CircularIconFrame from "$lib/components/common/icons/CircularIconFrame.svelte";
	import LoadingSpinner from "$lib/components/common/feedback/LoadingSpinner/LoadingSpinner.svelte";
	import TutorialStepIcon from "$lib/components/app/TutorialStepIcon.svelte";
	import { tutorialSteps } from "../../../defaults/tutorialSteps";

	let {
		open = false,
		onRemindLater,
		onDontShowAgain,
	}: {
		open?: boolean;
		onRemindLater: () => boolean | Promise<boolean>;
		onDontShowAgain: () => boolean | Promise<boolean>;
	} = $props();

	let currentStepIndex = $state(0);
	let busy = $state(false);
	let error = $state("");
	let dialogElement = $state<HTMLElement | null>(null);
	let returnFocusElement: HTMLElement | null = null;
	let previouslyOpen = false;

	const currentStep = $derived(tutorialSteps[currentStepIndex]);
	const isFirstStep = $derived(currentStepIndex === 0);
	const isLastStep = $derived(currentStepIndex === tutorialSteps.length - 1);

	const moveStep = (direction: -1 | 1) => {
		currentStepIndex = Math.min(
			tutorialSteps.length - 1,
			Math.max(0, currentStepIndex + direction),
		);
		error = "";
	};

	const saveChoice = async (choice: "later" | "never") => {
		if (busy) return;

		busy = true;
		error = "";

		let saved = false;
		try {
			saved = await (choice === "later"
				? onRemindLater()
				: onDontShowAgain());
		} catch {
			saved = false;
		}

		if (!saved) {
			error = "We could not save that choice. Please try again.";
		}

		busy = false;
	};

	const keepFocusInsideDialog = (event: KeyboardEvent) => {
		if (event.key !== "Tab" || !dialogElement) return;

		const focusableElements = Array.from(
			dialogElement.querySelectorAll<HTMLElement>(
				'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
			),
		);
		const firstElement = focusableElements[0];
		const lastElement = focusableElements.at(-1);
		if (!firstElement || !lastElement) return;

		if (event.shiftKey && document.activeElement === firstElement) {
			event.preventDefault();
			lastElement.focus();
		} else if (!event.shiftKey && document.activeElement === lastElement) {
			event.preventDefault();
			firstElement.focus();
		}
	};

	$effect(() => {
		if (open && !previouslyOpen) {
			returnFocusElement =
				typeof document !== "undefined" &&
				document.activeElement instanceof HTMLElement
					? document.activeElement
					: null;
			currentStepIndex = 0;
			error = "";
			tick().then(() => dialogElement?.focus());
		} else if (!open && previouslyOpen) {
			tick().then(() => returnFocusElement?.focus());
		}

		previouslyOpen = open;
	});

	$effect(() => {
		if (!open || typeof document === "undefined") return;

		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";

		return () => {
			document.body.style.overflow = previousOverflow;
		};
	});
</script>

{#if open}
	<div class="tutorial-backdrop" role="presentation">
		<div
			class="tutorial"
			role="dialog"
			aria-modal="true"
			aria-labelledby="tutorial-title"
			aria-describedby="tutorial-description"
			tabindex="-1"
			bind:this={dialogElement}
			onkeydown={keepFocusInsideDialog}
		>
			<header class="tutorial__header">
				<div>
					<span class="tutorial__eyebrow">Quick tour</span>
					<p class="tutorial__progress">
						Step {currentStepIndex + 1} of {tutorialSteps.length}
					</p>
				</div>
				<div class="tutorial__dots" aria-hidden="true">
					{#each tutorialSteps as _, index}
						<span class:active={index === currentStepIndex}></span>
					{/each}
				</div>
			</header>

			<div class="tutorial__body">
				<CircularIconFrame class="tutorial__illustration" decorative>
					<TutorialStepIcon name={currentStep.icon} />
				</CircularIconFrame>

				<div class="tutorial__copy">
					<h2 id="tutorial-title">{currentStep.title}</h2>
					<p id="tutorial-description">{currentStep.description}</p>
					<ul>
						{#each currentStep.points as point}
							<li>{point}</li>
						{/each}
					</ul>
				</div>
			</div>

			<footer class="tutorial__footer">
				{#if error}
					<p class="tutorial__error" role="alert">{error}</p>
				{/if}

				<div class="tutorial__navigation">
					<button
						class="tutorial__secondary"
						type="button"
						disabled={isFirstStep || busy}
						onclick={() => moveStep(-1)}
					>
						Previous
					</button>
					<button
						class="tutorial__next"
						type="button"
						disabled={isLastStep || busy}
						onclick={() => moveStep(1)}
					>
						Next
					</button>
				</div>

				<div class="tutorial__choices">
					<button
						class="tutorial__secondary"
						type="button"
						disabled={busy}
						onclick={() => saveChoice("later")}
					>
						Remind me in 7 days
					</button>
					<button
						class="tutorial__primary"
						type="button"
						disabled={busy}
						onclick={() => saveChoice("never")}
					>
						{#if busy}<LoadingSpinner size="small" decorative />{/if}
						Don’t show again
					</button>
				</div>
			</footer>
		</div>
	</div>
{/if}

<style lang="scss">
	@use "../../../styles/variables" as *;

	.tutorial-backdrop {
		position: fixed;
		inset: 0;
		z-index: 300;
		display: grid;
		place-items: center;
		padding: $app-gap-sm;
		background: rgba(26, 58, 90, 0.28);
		backdrop-filter: blur(3px);
	}

	.tutorial {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;
		width: min(34rem, 100%);
		max-height: min(42rem, calc(100dvh - 2 * $app-gap-sm));
		overflow: hidden;
		background: $app-section-bg;
		border: $app-border;
		border-radius: $app-guest-card-radius;
	}

	.tutorial:focus-visible {
		outline: $app-focus-outline;
		outline-offset: 3px;
	}

	.tutorial__header,
	.tutorial__footer {
		padding: $app-gap-md;
		background: $app-section-bg;
	}

	.tutorial__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: $app-gap-sm;
		border-bottom: $app-border;
	}

	.tutorial__eyebrow {
		color: $app-primary;
		font-size: $app-font-size-xs;
		font-weight: $app-font-weight-bold;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.tutorial__progress {
		margin-top: 0.1rem;
		color: $app-muted;
		font-size: $app-font-size-sm;
	}

	.tutorial__dots {
		display: flex;
		gap: $app-gap-xs;

		span {
			width: 0.55rem;
			height: 0.55rem;
			background: $app-border-color;
			border-radius: 50%;
		}

		.active {
			background: $app-highlight;
		}
	}

	.tutorial__body {
		display: grid;
		grid-template-columns: 7rem minmax(0, 1fr);
		align-items: center;
		gap: $app-gap-lg;
		min-height: 0;
		padding: $app-padding;
		overflow-y: auto;
	}

	:global(.tutorial__illustration) {
		--circular-icon-frame-size: #{7rem};
		--circular-icon-frame-icon-size: #{4.06rem};
		--circular-icon-frame-color: #{$app-primary};
		--circular-icon-frame-background: #{$app-highlight};
	}

	.tutorial__copy {
		min-width: 0;

		h2 {
			font-family: $app-font-family-display;
			font-size: clamp(1.4rem, 5vw, 2rem);
			font-weight: $app-font-weight-bold;
			text-wrap: balance;
		}

		p {
			margin-top: $app-gap-sm;
			color: $app-muted;
			font-size: $app-font-size-md;
		}

		ul {
			display: grid;
			gap: $app-gap-sm;
			margin-top: $app-gap-md;
			padding-left: 1.15rem;
		}

		li {
			padding-left: $app-gap-xs;
			font-size: $app-font-size-md;
		}

		li::marker {
			color: $app-highlight-hover;
		}
	}

	.tutorial__footer {
		display: grid;
		gap: $app-gap-sm;
		border-top: $app-border;
	}

	.tutorial__navigation,
	.tutorial__choices {
		display: flex;
		gap: $app-gap-sm;
	}

	.tutorial__navigation {
		justify-content: space-between;
	}

	.tutorial__choices button {
		flex: 1 1 0;
	}

	.tutorial__primary {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: $app-gap-xs;
		color: $app-btn-text;
		background: $app-btn-bg;
	}

	.tutorial__next {
		color: $app-highlight-text;
		background: $app-highlight;
	}

	.tutorial__secondary {
		color: $app-primary;
		background: $app-accent;
	}

	.tutorial__primary:disabled,
	.tutorial__next:disabled,
	.tutorial__secondary:disabled {
		cursor: not-allowed;
		opacity: 0.55;
	}

	.tutorial__error {
		padding: $app-gap-sm;
		color: $app-warning-strong;
		background: $app-warning-bg;
		border: $app-warning-border;
		border-radius: $app-radius-sm;
		font-size: $app-font-size-sm;
		font-weight: $app-font-weight-semibold;
	}

	@media (max-width: $app-breakpoint-sm) {
		.tutorial__body {
			grid-template-columns: 1fr;
			gap: $app-gap-md;
			padding: $app-gap-md;
		}

		:global(.tutorial__illustration) {
			--circular-icon-frame-size: #{5rem};
			--circular-icon-frame-icon-size: #{2.9rem};
		}

		.tutorial__choices {
			flex-direction: column-reverse;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.tutorial-backdrop {
			backdrop-filter: none;
		}
	}
</style>
