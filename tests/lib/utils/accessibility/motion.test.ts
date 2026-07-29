import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	getMotionSafeDuration,
	getMotionSafeScrollBehavior,
	prefersReducedMotion,
} from "$lib/utils/accessibility/motion";

const setReducedMotion = (matches: boolean) => {
	Object.defineProperty(window, "matchMedia", {
		configurable: true,
		value: vi.fn(() => ({ matches })),
	});
};

describe("motion accessibility", () => {
	beforeEach(() => {
		setReducedMotion(false);
	});

	it("keeps requested motion when reduced motion is not enabled", () => {
		expect(prefersReducedMotion()).toBe(false);
		expect(getMotionSafeDuration(180)).toBe(180);
		expect(getMotionSafeScrollBehavior()).toBe("smooth");
	});

	it("removes functional motion when reduced motion is enabled", () => {
		setReducedMotion(true);

		expect(prefersReducedMotion()).toBe(true);
		expect(getMotionSafeDuration(180)).toBe(0);
		expect(getMotionSafeScrollBehavior()).toBe("auto");
	});

	it("never returns a negative duration", () => {
		expect(getMotionSafeDuration(-100)).toBe(0);
	});
});
