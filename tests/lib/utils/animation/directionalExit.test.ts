import { beforeEach, describe, expect, it, vi } from "vitest";
import { animateDirectionalExit } from "$lib/utils/animation/directionalExit";

const setReducedMotion = (matches: boolean) => {
	Object.defineProperty(window, "matchMedia", {
		configurable: true,
		value: vi.fn(() => ({ matches })),
	});
};

describe("animateDirectionalExit", () => {
	beforeEach(() => {
		setReducedMotion(false);
	});

	it("starts every selected element in the same direction before waiting", async () => {
		const first = document.createElement("article");
		const second = document.createElement("article");
		const cancelFirst = vi.fn();
		const cancelSecond = vi.fn();
		const animateFirst = vi.fn((_keyframes: Keyframe[], _options?: KeyframeAnimationOptions) => ({
			finished: Promise.resolve(),
			cancel: cancelFirst,
		}) as unknown as Animation);
		const animateSecond = vi.fn((_keyframes: Keyframe[], _options?: KeyframeAnimationOptions) => ({
			finished: Promise.resolve(),
			cancel: cancelSecond,
		}) as unknown as Animation);
		first.animate = animateFirst;
		second.animate = animateSecond;

		const controller = animateDirectionalExit([first, second], "right");

		expect(animateFirst).toHaveBeenCalledOnce();
		expect(animateSecond).toHaveBeenCalledOnce();
		expect(animateFirst.mock.calls[0][0]).toEqual([
			{ opacity: 1, transform: "translate3d(0, 0, 0)" },
			{ opacity: 0, transform: "translate3d(110%, 0, 0)" },
		]);
		await controller.finished;
		controller.cancel();
		expect(cancelFirst).toHaveBeenCalledOnce();
		expect(cancelSecond).toHaveBeenCalledOnce();
	});

	it("skips movement when reduced motion is requested", async () => {
		setReducedMotion(true);
		const element = document.createElement("article");
		const animate = vi.fn();
		element.animate = animate;

		const controller = animateDirectionalExit([element], "left");
		await controller.finished;

		expect(animate).not.toHaveBeenCalled();
	});
});
