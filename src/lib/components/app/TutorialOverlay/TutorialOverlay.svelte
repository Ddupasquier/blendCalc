<script lang="ts">
	import { tick } from "svelte";
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import CircularIconFrame from "$lib/components/common/icons/CircularIconFrame/CircularIconFrame.svelte";
	import TutorialStepIcon from "$lib/components/app/TutorialStepIcon/TutorialStepIcon.svelte";
	import { tutorialSteps } from "$lib/utils/tutorial/steps";
	import type { TutorialOverlayProps } from "./types";

	let {
		open = false,
		mode = "onboarding",
		onFinish,
	}: TutorialOverlayProps = $props();

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

	const finishTutorial = async () => {
		if (busy) return;

		busy = true;
		error = "";

		let saved = false;
		try {
			saved = await onFinish();
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
					<RoundedActionButton
						variant="neutral"
						disabled={isFirstStep || busy}
						onclick={() => moveStep(-1)}
					>
						Previous
					</RoundedActionButton>
					{#if isLastStep}
						<RoundedActionButton busy={busy} onclick={() => void finishTutorial()}>
							{mode === "replay" ? "Close tutorial" : "Finish tutorial"}
						</RoundedActionButton>
					{:else}
						<RoundedActionButton disabled={busy} onclick={() => moveStep(1)}>
							Next
						</RoundedActionButton>
					{/if}
				</div>
			</footer>
		</div>
	</div>
{/if}

<style lang="scss">
	@use "./TutorialOverlay.scss";
</style>
