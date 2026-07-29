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
