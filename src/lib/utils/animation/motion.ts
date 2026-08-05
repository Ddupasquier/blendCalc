export const MOTION_DURATION_MS = Object.freeze({
	press: 120,
	state: 160,
	feedback: 180,
	layout: 220,
	sheetRight: 240,
	sheetBottom: 260,
	reflow: 320,
});

export const MOTION_EASING = Object.freeze({
	standard: "ease",
	spatial: "cubic-bezier(0.4, 0, 0.2, 1)",
});

export const prefersReducedMotion = (): boolean =>
	typeof window !== "undefined" &&
	typeof window.matchMedia === "function" &&
	window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const getMotionSafeDuration = (duration: number): number =>
	prefersReducedMotion() ? 0 : Math.max(0, duration);

export const getMotionSafeScrollBehavior = (): ScrollBehavior => {
	if (prefersReducedMotion()) {
		return "auto";
	}
	return "smooth";
};
