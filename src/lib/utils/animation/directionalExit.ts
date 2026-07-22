import { prefersReducedMotion } from "$lib/utils/accessibility/motion";

export type DirectionalExitDirection = "left" | "right";

export type DirectionalExitController = {
	finished: Promise<void>;
	cancel: () => void;
};

const EXIT_DURATION_MS = 240;
const EXIT_EASING = "cubic-bezier(0.4, 0, 0.2, 1)";

const completedController = (): DirectionalExitController => ({
	finished: Promise.resolve(),
	cancel: () => undefined,
});

export const animateDirectionalExit = (
	elements: HTMLElement[],
	direction: DirectionalExitDirection,
): DirectionalExitController => {
	if (elements.length === 0 || prefersReducedMotion()) {
		return completedController();
	}

	const distance = direction === "right" ? "110%" : "-110%";
	const animations = elements
		.filter((element) => typeof element.animate === "function")
		.map((element) =>
			element.animate(
				[
					{ opacity: 1, transform: "translate3d(0, 0, 0)" },
					{ opacity: 0, transform: `translate3d(${distance}, 0, 0)` },
				],
				{
					duration: EXIT_DURATION_MS,
					easing: EXIT_EASING,
					fill: "forwards",
				},
			),
		);

	if (animations.length === 0) return completedController();

	return {
		finished: Promise.all(
			animations.map((animation) => animation.finished.catch(() => undefined)),
		).then(() => undefined),
		cancel: () => animations.forEach((animation) => animation.cancel()),
	};
};
