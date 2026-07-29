<script lang="ts">
	import { tick } from "svelte";
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import CircularIconFrame from "$lib/components/common/icons/CircularIconFrame/CircularIconFrame.svelte";
	import TutorialStepIcon from "$lib/components/app/TutorialStepIcon/TutorialStepIcon.svelte";
	import {
		manageDialogFocus,
		trapDialogFocus,
	} from "$lib/utils/accessibility/dialogFocus";
	import { getMotionSafeScrollBehavior } from "$lib/utils/accessibility/motion";
	import {
		getTutorialBorderRadius,
		getTutorialCardPosition,
		getTutorialRoundedRectPath,
		getTutorialSpotlightGap,
		getTutorialSpotlightRadii,
		getTutorialSpotlightRect,
		parseTutorialCornerRadius,
	} from "$lib/utils/tutorial/spotlight";
	import { tutorialSteps } from "$lib/utils/tutorial/steps";
	import type { TutorialChoice } from "$lib/utils/tutorial/tutorial";
	import type {
		TutorialCornerRadii,
		TutorialRect,
	} from "$lib/utils/tutorial/types";
	import type { TutorialOverlayProps } from "./types";

	let {
		open = false,
		mode = "onboarding",
		pathname,
		onNavigate,
		onFinish,
	}: TutorialOverlayProps = $props();

	let currentStepIndex = $state(0);
	let saving = $state(false);
	let moving = $state(false);
	let error = $state("");
	let tourElement = $state<HTMLElement | null>(null);
	let dialogElement = $state<HTMLElement | null>(null);
	let targetElement = $state<HTMLElement | null>(null);
	let spotlightRect = $state<TutorialRect | null>(null);
	let spotlightRadii = $state<TutorialCornerRadii | null>(null);
	let cardPosition = $state({ top: 0, left: 0 });
	let previouslyOpen = false;
	let releaseFocus: (() => void) | null = null;
	let activationId = 0;

	const currentStep = $derived(tutorialSteps[currentStepIndex]);
	const isFirstStep = $derived(currentStepIndex === 0);
	const isLastStep = $derived(currentStepIndex === tutorialSteps.length - 1);
	const controlsBusy = $derived(saving || moving);
	const spotlightBorderRadius = $derived(
		spotlightRadii ? getTutorialBorderRadius(spotlightRadii) : "0",
	);
	const spotlightMaskPath = $derived(
		spotlightRect && spotlightRadii
			? getTutorialRoundedRectPath(spotlightRect, spotlightRadii)
			: "",
	);

	const readRect = (rect: DOMRect): TutorialRect => ({
		top: rect.top,
		right: rect.right,
		bottom: rect.bottom,
		left: rect.left,
		width: rect.width,
		height: rect.height,
	});

	const setTargetElement = (nextTarget: HTMLElement | null) => {
		if (targetElement && targetElement !== nextTarget) {
			targetElement.removeAttribute("data-tutorial-active");
		}
		targetElement = nextTarget;
		if (targetElement) {
			targetElement.setAttribute("data-tutorial-active", "true");
		}
	};

	const centerCard = () => {
		if (!dialogElement || typeof window === "undefined") return;
		const cardRect = dialogElement.getBoundingClientRect();
		cardPosition = {
			top: Math.max(12, (window.innerHeight - cardRect.height) / 2),
			left: Math.max(12, (window.innerWidth - cardRect.width) / 2),
		};
	};

	const updateGeometry = () => {
		if (
			!open ||
			!dialogElement ||
			!targetElement?.isConnected ||
			typeof window === "undefined"
		) {
			spotlightRect = null;
			spotlightRadii = null;
			centerCard();
			return;
		}

		const targetRect = targetElement.getBoundingClientRect();
		if (targetRect.width <= 0 || targetRect.height <= 0) {
			spotlightRect = null;
			spotlightRadii = null;
			centerCard();
			return;
		}

		const rootFontSize = Number.parseFloat(
			window.getComputedStyle(document.documentElement).fontSize,
		);
		const spotlightGap = getTutorialSpotlightGap(
			Number.isFinite(rootFontSize) ? rootFontSize : 16,
		);
		const viewport = {
			width: window.innerWidth,
			height: window.innerHeight,
		};
		const boundaryElement =
			targetElement.closest<HTMLElement>(".view-frame") ??
			targetElement.closest<HTMLElement>(".app-main");
		const boundaryRect = boundaryElement?.getBoundingClientRect();
		const targetStyle = window.getComputedStyle(targetElement);
		const targetRadii: TutorialCornerRadii = {
			topLeft: parseTutorialCornerRadius(
				targetStyle.borderTopLeftRadius,
				targetRect,
			),
			topRight: parseTutorialCornerRadius(
				targetStyle.borderTopRightRadius,
				targetRect,
			),
			bottomRight: parseTutorialCornerRadius(
				targetStyle.borderBottomRightRadius,
				targetRect,
			),
			bottomLeft: parseTutorialCornerRadius(
				targetStyle.borderBottomLeftRadius,
				targetRect,
			),
		};
		const nextSpotlightRect = getTutorialSpotlightRect(
			readRect(targetRect),
			viewport,
			spotlightGap,
			0,
			boundaryRect && boundaryRect.width > 0 && boundaryRect.height > 0
				? readRect(boundaryRect)
				: undefined,
		);
		const cardRect = dialogElement.getBoundingClientRect();

		spotlightRect = nextSpotlightRect;
		spotlightRadii = getTutorialSpotlightRadii(
			targetRadii,
			readRect(targetRect),
			nextSpotlightRect,
		);
		cardPosition = getTutorialCardPosition(
			nextSpotlightRect,
			{ width: cardRect.width, height: cardRect.height },
			viewport,
		);
	};

	const findCurrentTarget = async () => {
		if (!open || typeof document === "undefined") return;

		await tick();
		setTargetElement(
			document.querySelector<HTMLElement>(currentStep.target),
		);

		if (!targetElement) {
			spotlightRect = null;
			spotlightRadii = null;
			centerCard();
			return;
		}

		targetElement.scrollIntoView({
			block: "center",
			inline: "nearest",
			behavior: getMotionSafeScrollBehavior(),
		});
		updateGeometry();
		window.requestAnimationFrame(updateGeometry);
	};

	const activateStep = async (nextStepIndex: number) => {
		if (controlsBusy) return;

		const nextActivationId = ++activationId;
		currentStepIndex = Math.min(
			tutorialSteps.length - 1,
			Math.max(0, nextStepIndex),
		);
		error = "";
		moving = true;
		setTargetElement(null);
		spotlightRect = null;
		spotlightRadii = null;

		const nextStep = tutorialSteps[currentStepIndex];
		try {
			if (pathname !== nextStep.route) {
				await onNavigate(nextStep.route);
			}
			if (nextActivationId !== activationId) return;
			await findCurrentTarget();
		} catch {
			if (nextActivationId === activationId) {
				error =
					"We couldn’t open that part of the tour. Check your connection and try again.";
			}
		} finally {
			if (nextActivationId === activationId) {
				moving = false;
				await tick();
				if (!releaseFocus && dialogElement) {
					releaseFocus = manageDialogFocus(dialogElement);
				} else {
					dialogElement?.focus({ preventScroll: true });
				}
			}
		}
	};

	const finishTutorial = async (choice: TutorialChoice) => {
		if (controlsBusy) return;

		saving = true;
		error = "";

		let saved = false;
		try {
			saved = await onFinish(choice);
		} catch {
			saved = false;
		}

		if (!saved) {
			error =
				"We couldn’t save that choice. Check your connection and try again.";
		}

		saving = false;
	};

	$effect(() => {
		if (open && !previouslyOpen) {
			currentStepIndex = 0;
			error = "";
			releaseFocus = dialogElement
				? manageDialogFocus(dialogElement)
				: null;
			void activateStep(0);
		} else if (!open && previouslyOpen) {
			activationId += 1;
			setTargetElement(null);
			spotlightRect = null;
			spotlightRadii = null;
			const restoreFocus = releaseFocus;
			releaseFocus = null;
			queueMicrotask(() => restoreFocus?.());
		}

		previouslyOpen = open;
	});

	$effect(() => {
		pathname;
		if (!open || pathname !== currentStep.route) return;
		void findCurrentTarget();
	});

	$effect(() => {
		if (!open || typeof window === "undefined") return;

		const handleGeometryChange = () => updateGeometry();
		window.addEventListener("resize", handleGeometryChange);
		document.addEventListener("scroll", handleGeometryChange, true);

		return () => {
			window.removeEventListener("resize", handleGeometryChange);
			document.removeEventListener("scroll", handleGeometryChange, true);
		};
	});

	$effect(() => {
		if (!open || !tourElement || typeof document === "undefined") return;

		const currentTourElement = tourElement;
		const backgroundElements = Array.from(
			document.querySelectorAll<HTMLElement>(
				".app-header, .tab-nav, .app-main",
			),
		).filter((element) => !currentTourElement.contains(element));
		const previousInertStates = backgroundElements.map((element) => ({
			element,
			hadInert: element.hasAttribute("inert"),
		}));
		const documentElementOverflow =
			document.documentElement.style.overflow;
		const bodyOverflow = document.body.style.overflow;

		for (const { element } of previousInertStates) {
			element.setAttribute("inert", "");
		}
		document.documentElement.style.overflow = "hidden";
		document.body.style.overflow = "hidden";

		return () => {
			for (const { element, hadInert } of previousInertStates) {
				if (!hadInert) element.removeAttribute("inert");
			}
			document.documentElement.style.overflow =
				documentElementOverflow;
			document.body.style.overflow = bodyOverflow;
		};
	});

	$effect(() => {
		if (
			!open ||
			typeof ResizeObserver === "undefined" ||
			!dialogElement
		) {
			return;
		}

		const resizeObserver = new ResizeObserver(updateGeometry);
		resizeObserver.observe(dialogElement);
		if (targetElement) {
			resizeObserver.observe(targetElement);
			const boundaryElement =
				targetElement.closest<HTMLElement>(".view-frame") ??
				targetElement.closest<HTMLElement>(".app-main");
			if (boundaryElement && boundaryElement !== targetElement) {
				resizeObserver.observe(boundaryElement);
			}
		}

		return () => resizeObserver.disconnect();
	});
</script>

{#if open}
	<div
		class="tutorial-tour"
		role="presentation"
		bind:this={tourElement}
	>
		{#if spotlightRect && spotlightRadii}
			<svg
				class="tutorial-shade"
				aria-hidden="true"
				width="100%"
				height="100%"
			>
				<defs>
					<mask
						id="tutorial-spotlight-mask"
						maskUnits="userSpaceOnUse"
						maskContentUnits="userSpaceOnUse"
						x="0"
						y="0"
						width="100%"
						height="100%"
					>
						<rect
							class="tutorial-shade__mask-base"
							width="100%"
							height="100%"
						/>
						<path
							class="tutorial-shade__mask-cutout"
							d={spotlightMaskPath}
						/>
					</mask>
				</defs>
				<rect
					class="tutorial-shade__fill"
					width="100%"
					height="100%"
					mask="url(#tutorial-spotlight-mask)"
				/>
			</svg>
			<div
				class="tutorial-spotlight"
				style:top={`${spotlightRect.top}px`}
				style:left={`${spotlightRect.left}px`}
				style:width={`${spotlightRect.width}px`}
				style:height={`${spotlightRect.height}px`}
				style:border-radius={spotlightBorderRadius}
				aria-hidden="true"
			></div>
		{:else}
			<div class="tutorial-shade-fallback" aria-hidden="true"></div>
		{/if}

		<div
			class="tutorial"
			role="dialog"
			aria-modal="true"
			aria-labelledby="tutorial-title"
			aria-describedby="tutorial-description tutorial-target-description"
			tabindex="-1"
			style:top={`${cardPosition.top}px`}
			style:left={`${cardPosition.left}px`}
			bind:this={dialogElement}
			onkeydown={(event) => {
				if (dialogElement) trapDialogFocus(event, dialogElement);
			}}
		>
			<header class="tutorial__header">
				<div>
					<span class="tutorial__eyebrow">Guided tour</span>
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
				<div class="tutorial__title-row">
					<CircularIconFrame class="tutorial__illustration" decorative>
						<TutorialStepIcon name={currentStep.icon} />
					</CircularIconFrame>
					<h2 id="tutorial-title">{currentStep.title}</h2>
				</div>
				<p id="tutorial-description">{currentStep.description}</p>
				<ul>
					{#each currentStep.points as point}
						<li>{point}</li>
					{/each}
				</ul>
				<p id="tutorial-target-description" class="sr-only">
					The highlighted area contains {currentStep.targetLabel}.
				</p>
			</div>

			<footer class="tutorial__footer">
				{#if error}
					<StatusMessage tone="danger" message={error} />
				{/if}

				{#if mode === "onboarding"}
					<div class="tutorial__dismissal">
						<RoundedActionButton
							variant="neutral"
							disabled={controlsBusy}
							onclick={() => void finishTutorial("later")}
						>
							Remind me in 7 days
						</RoundedActionButton>
						<RoundedActionButton
							variant="neutral"
							disabled={controlsBusy}
							onclick={() => void finishTutorial("complete")}
						>
							Don’t show again
						</RoundedActionButton>
					</div>
				{/if}

				<div
					class="tutorial__navigation"
					class:tutorial__navigation--replay={mode === "replay"}
				>
					{#if mode === "replay"}
						<RoundedActionButton
							variant="neutral"
							disabled={controlsBusy}
							onclick={() => void finishTutorial("complete")}
						>
							Exit tour
						</RoundedActionButton>
					{/if}
					<RoundedActionButton
						variant="neutral"
						disabled={isFirstStep || controlsBusy}
						onclick={() => void activateStep(currentStepIndex - 1)}
					>
						Previous
					</RoundedActionButton>
					{#if isLastStep}
						<RoundedActionButton
							busy={saving}
							onclick={() => void finishTutorial("complete")}
						>
							{mode === "replay"
								? "Close tutorial"
								: "Finish tutorial"}
						</RoundedActionButton>
					{:else}
						<RoundedActionButton
							busy={moving}
							disabled={saving}
							onclick={() => void activateStep(currentStepIndex + 1)}
						>
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
