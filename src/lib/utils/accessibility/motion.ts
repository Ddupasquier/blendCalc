export const prefersReducedMotion = (): boolean =>
	typeof window !== "undefined" &&
	typeof window.matchMedia === "function" &&
	window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const getMotionSafeScrollBehavior = (): ScrollBehavior => {
	if (prefersReducedMotion()) {
		return "auto";
	}
	return "smooth";
};
