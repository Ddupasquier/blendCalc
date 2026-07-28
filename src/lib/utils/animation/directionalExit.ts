import { prefersReducedMotion } from "$lib/utils/accessibility/motion";

export type DirectionalExitDirection = "left" | "right";

export type DirectionalExitController = {
	finished: Promise<void>;
	cancel: () => void;
};

export type DirectionalExitOptions = {
	anticipationPercent?: number;
	staggerMs?: number;
	unclipFromContainer?: boolean;
};

const EXIT_DURATION_MS = 360;
const EXIT_EASING = "cubic-bezier(0.4, 0, 0.2, 1)";

const completedController = (): DirectionalExitController => ({
	finished: Promise.resolve(),
	cancel: () => undefined,
});

const removeDuplicateIds = (element: HTMLElement) => {
	element.removeAttribute("id");
	element.querySelectorAll<HTMLElement>("[id]").forEach((child) => {
		child.removeAttribute("id");
	});
};

const createUnclippedTarget = (source: HTMLElement) => {
	const bounds = source.getBoundingClientRect();
	const target = source.cloneNode(true) as HTMLElement;
	const previousVisibility = source.style.visibility;
	let cleaned = false;

	removeDuplicateIds(target);
	target.dataset.directionalExitClone = "";
	target.setAttribute("aria-hidden", "true");
	target.setAttribute("inert", "");
	Object.assign(target.style, {
		height: `${bounds.height}px`,
		left: `${bounds.left}px`,
		margin: "0",
		maxWidth: "none",
		pointerEvents: "none",
		position: "fixed",
		top: `${bounds.top}px`,
		width: `${bounds.width}px`,
		zIndex: "1000",
	});
	document.body.append(target);
	source.style.visibility = "hidden";

	return {
		animate: (keyframes: Keyframe[], timing: KeyframeAnimationOptions) =>
			source.animate.call(target, keyframes, timing),
		cleanup: () => {
			if (cleaned) return;
			cleaned = true;
			target.remove();
			source.style.visibility = previousVisibility;
		},
	};
};

export const animateDirectionalExit = (
	elements: HTMLElement[],
	direction: DirectionalExitDirection,
	options: DirectionalExitOptions = {},
): DirectionalExitController => {
	if (elements.length === 0 || prefersReducedMotion()) {
		return completedController();
	}

	const distance = direction === "right" ? "110%" : "-110%";
	const anticipationDistance =
		direction === "right"
			? `-${options.anticipationPercent ?? 0}%`
			: `${options.anticipationPercent ?? 0}%`;
	const keyframes: Keyframe[] =
		(options.anticipationPercent ?? 0) > 0
			? [
					{
						offset: 0,
						opacity: 1,
						transform: "translate3d(0, 0, 0)",
					},
					{
						offset: 0.18,
						opacity: 1,
						transform: `translate3d(${anticipationDistance}, 0, 0)`,
					},
					{
						offset: 1,
						opacity: 0,
						transform: `translate3d(${distance}, 0, 0)`,
					},
				]
			: [
					{ opacity: 1, transform: "translate3d(0, 0, 0)" },
					{
						opacity: 0,
						transform: `translate3d(${distance}, 0, 0)`,
					},
				];
	const targets = elements
		.filter((element) => typeof element.animate === "function")
		.map((element) =>
			options.unclipFromContainer
				? createUnclippedTarget(element)
				: {
						animate: (
							frames: Keyframe[],
							timing: KeyframeAnimationOptions,
						) => element.animate(frames, timing),
						cleanup: () => undefined,
					},
		);
	const animations = targets.map((target, index) =>
		target.animate(
			keyframes,
			{
				delay: index * Math.max(0, options.staggerMs ?? 0),
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
		cancel: () => {
			animations.forEach((animation) => animation.cancel());
			targets.forEach((target) => target.cleanup());
		},
	};
};
