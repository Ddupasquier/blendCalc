import { prefersReducedMotion } from "./motion";

const DEFAULT_DURATION_MS = 180;

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

		const currentHeight = element.open
			? content.getBoundingClientRect().height
			: 0;
		const currentOpacity = element.open
			? Number.parseFloat(getComputedStyle(content).opacity) || 1
			: 0;

		animation?.cancel();
		animation = null;
		expanded = nextOpen;
		reflectExpandedState();

		if (
			prefersReducedMotion() ||
			typeof content.animate !== "function"
		) {
			element.open = nextOpen;
			return;
		}

		element.open = true;
		const fullHeight = content.scrollHeight;
		const startHeight = currentHeight || (nextOpen ? 0 : fullHeight);
		const targetHeight = nextOpen ? fullHeight : 0;
		const startOpacity = currentHeight > 0 ? currentOpacity : nextOpen ? 0 : 1;
		const targetOpacity = nextOpen ? 1 : 0;

		animation = content.animate(
			[
				{
					height: `${startHeight}px`,
					opacity: startOpacity,
					overflow: "hidden",
				},
				{
					height: `${targetHeight}px`,
					opacity: targetOpacity,
					overflow: "hidden",
				},
			],
			{
				duration,
				easing: "ease",
			},
		);

		animation.onfinish = () => {
			if (!expanded) element.open = false;
			animation = null;
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
			animation?.cancel();
			summary.removeEventListener("click", handleSummaryClick);
			element.removeEventListener("toggle", handleToggle);
			controllers.delete(element);
		},
	};
};
