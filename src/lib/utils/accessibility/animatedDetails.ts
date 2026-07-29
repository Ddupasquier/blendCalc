import { getMotionSafeDuration } from "./motion";

const DEFAULT_DURATION_MS = 180;
const DISCLOSURE_EASING = "cubic-bezier(0.4, 0, 0.2, 1)";

type AnimatedDetailsOptions = {
	duration?: number;
};

type AnimatedDetailsController = {
	setOpen: (open: boolean) => void;
};

const controllers = new WeakMap<HTMLDetailsElement, AnimatedDetailsController>();

export const setAnimatedDetailsOpen = (
	element: HTMLDetailsElement,
	open: boolean,
) => {
	const controller = controllers.get(element);
	if (controller) {
		controller.setOpen(open);
		return;
	}

	element.open = open;
	element.dataset.expanded = String(open);
};

export const animatedDetails = (
	element: HTMLDetailsElement,
	options: AnimatedDetailsOptions = {},
) => {
	const summary = element.querySelector(":scope > summary");
	const content = summary?.nextElementSibling;
	if (
		!(summary instanceof HTMLElement) ||
		!(content instanceof HTMLElement)
	) {
		return {};
	}

	const duration = options.duration ?? DEFAULT_DURATION_MS;
	let expanded = element.open;
	let animation: Animation | null = null;

	const reflectExpandedState = () => {
		element.dataset.expanded = String(expanded);
		summary.setAttribute("aria-expanded", String(expanded));
	};

	const setOpen = (nextOpen: boolean) => {
		if (nextOpen === expanded && animation === null) return;

		const wasRendered = element.open;
		const currentHeight = element.getBoundingClientRect().height;

		const previousAnimation = animation;
		animation = null;
		previousAnimation?.cancel();
		expanded = nextOpen;
		reflectExpandedState();

		const motionDuration = getMotionSafeDuration(duration);
		if (motionDuration === 0 || typeof element.animate !== "function") {
			element.open = nextOpen;
			return;
		}

		element.open = true;
		const fullHeight = element.getBoundingClientRect().height;
		const elementStyles = getComputedStyle(element);
		const collapsedHeight =
			summary.getBoundingClientRect().height +
			(Number.parseFloat(elementStyles.paddingTop) || 0) +
			(Number.parseFloat(elementStyles.paddingBottom) || 0) +
			(Number.parseFloat(elementStyles.borderTopWidth) || 0) +
			(Number.parseFloat(elementStyles.borderBottomWidth) || 0);
		const startHeight = wasRendered
			? currentHeight
			: nextOpen
				? collapsedHeight
				: fullHeight;
		const targetHeight = nextOpen ? fullHeight : collapsedHeight;

		const nextAnimation = element.animate(
			[
				{
					height: `${startHeight}px`,
					overflow: "hidden",
				},
				{
					height: `${targetHeight}px`,
					overflow: "hidden",
				},
			],
			{
				duration: motionDuration,
				easing: DISCLOSURE_EASING,
				fill: "both",
			},
		);
		animation = nextAnimation;

		nextAnimation.onfinish = () => {
			if (animation !== nextAnimation) return;
			animation = null;
			nextAnimation.onfinish = null;
			nextAnimation.oncancel = null;
			if (!expanded) element.open = false;
			nextAnimation.cancel();
		};
		nextAnimation.oncancel = () => {
			if (animation === nextAnimation) animation = null;
		};
	};

	const handleSummaryClick = (event: Event) => {
		event.preventDefault();
		setOpen(!expanded);
	};

	const handleToggle = () => {
		if (element.open === expanded) return;
		setOpen(element.open);
	};

	reflectExpandedState();
	summary.addEventListener("click", handleSummaryClick);
	element.addEventListener("toggle", handleToggle);
	controllers.set(element, { setOpen });

	return {
		destroy() {
			const activeAnimation = animation;
			animation = null;
			activeAnimation?.cancel();
			summary.removeEventListener("click", handleSummaryClick);
			element.removeEventListener("toggle", handleToggle);
			controllers.delete(element);
		},
	};
};
