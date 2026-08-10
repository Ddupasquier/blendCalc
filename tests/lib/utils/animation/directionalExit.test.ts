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

	it("animates every element in the requested direction before waiting", async () => {
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

	it("stagger starts and adds an opposite-direction anticipation", async () => {
		const first = document.createElement("article");
		const second = document.createElement("article");
		const animateFirst = vi.fn(
			(_keyframes: Keyframe[], _options?: KeyframeAnimationOptions) =>
				({
					finished: Promise.resolve(),
					cancel: vi.fn(),
				}) as unknown as Animation,
		);
		const animateSecond = vi.fn(
			(_keyframes: Keyframe[], _options?: KeyframeAnimationOptions) =>
				({
					finished: Promise.resolve(),
					cancel: vi.fn(),
				}) as unknown as Animation,
		);
		first.animate = animateFirst;
		second.animate = animateSecond;

		const controller = animateDirectionalExit([first, second], "right", {
			anticipationPercent: 3,
			staggerMs: 50,
		});

		expect(animateFirst.mock.calls[0][0]).toEqual([
			{
				offset: 0,
				opacity: 1,
				transform: "translate3d(0, 0, 0)",
			},
			{
				offset: 0.18,
				opacity: 1,
				transform: "translate3d(-3%, 0, 0)",
			},
			{
				offset: 1,
				opacity: 0,
				transform: "translate3d(110%, 0, 0)",
			},
		]);
		expect(animateFirst.mock.calls[0][1]).toMatchObject({ delay: 0 });
		expect(animateSecond.mock.calls[0][1]).toMatchObject({ delay: 50 });
		expect(animateFirst.mock.calls[0][1]).toMatchObject({ duration: 360 });
		await controller.finished;
	});

	it("mirrors the anticipation before a left exit", async () => {
		const element = document.createElement("article");
		const animate = vi.fn(
			(_keyframes: Keyframe[], _options?: KeyframeAnimationOptions) =>
				({
					finished: Promise.resolve(),
					cancel: vi.fn(),
				}) as unknown as Animation,
		);
		element.animate = animate;

		const controller = animateDirectionalExit([element], "left", {
			anticipationPercent: 3,
			staggerMs: 50,
		});

		expect(animate.mock.calls[0][0]).toEqual([
			{
				offset: 0,
				opacity: 1,
				transform: "translate3d(0, 0, 0)",
			},
			{
				offset: 0.18,
				opacity: 1,
				transform: "translate3d(3%, 0, 0)",
			},
			{
				offset: 1,
				opacity: 0,
				transform: "translate3d(-110%, 0, 0)",
			},
		]);
		await controller.finished;
	});

	it("uses a temporary visual copy outside clipping containers", async () => {
		const element = document.createElement("article");
		const child = document.createElement("span");
		let animatedTarget: HTMLElement | null = null;
		child.id = "nested-card-control";
		element.id = "saved-card";
		element.append(child);
		element.style.visibility = "visible";
		Object.defineProperty(element, "getBoundingClientRect", {
			configurable: true,
			value: () => ({
				bottom: 100,
				height: 80,
				left: 20,
				right: 320,
				top: 20,
				width: 300,
				x: 20,
				y: 20,
				toJSON: () => ({}),
			}),
		});
		element.animate = vi.fn(function (this: HTMLElement) {
			animatedTarget = this;
			return {
				finished: Promise.resolve(),
				cancel: vi.fn(),
			} as unknown as Animation;
		});
		document.body.append(element);

		const controller = animateDirectionalExit([element], "right", {
			unclipFromContainer: true,
		});
		const clone = document.querySelector<HTMLElement>(
			"[data-directional-exit-clone]",
		);

		expect(clone).not.toBeNull();
		expect(animatedTarget).toBe(clone);
		expect(element).toHaveStyle({ visibility: "hidden" });
		expect(clone).toHaveAttribute("aria-hidden", "true");
		expect(clone).toHaveAttribute("inert");
		expect(clone).not.toHaveAttribute("id");
		expect(clone?.querySelector("[id]")).toBeNull();
		expect(clone).toHaveStyle({
			height: "80px",
			left: "20px",
			position: "fixed",
			top: "20px",
			width: "300px",
		});

		await controller.finished;
		controller.cancel();

		expect(
			document.querySelector("[data-directional-exit-clone]"),
		).not.toBeInTheDocument();
		expect(element).toHaveStyle({ visibility: "visible" });
		element.remove();
	});

	it("skips movement when reduced motion is requested", async () => {
		setReducedMotion(true);
		const element = document.createElement("article");
		const animate = vi.fn();
		element.animate = animate;

		const controller = animateDirectionalExit([element], "left", {
			anticipationPercent: 3,
			staggerMs: 50,
		});
		await controller.finished;

		expect(animate).not.toHaveBeenCalled();
	});
});
