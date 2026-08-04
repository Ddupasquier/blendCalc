import { afterEach, describe, expect, it, vi } from "vitest";
import {
	animatedDetails,
	setAnimatedDetailsOpen,
} from "$lib/utils/animation/animatedDetails";

type TestAnimation = Animation & {
	keyframes: Keyframe[];
	oncancel: (() => void) | null;
	onfinish: (() => void) | null;
	timing: KeyframeAnimationOptions;
};

afterEach(() => {
	document.body.replaceChildren();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

const createDisclosure = (open = false) => {
	document.body.innerHTML = `
		<details ${open ? "open" : ""}>
			<summary>Details</summary>
			<div><input value="Unsaved value" /></div>
		</details>
	`;
	const details = document.querySelector("details") as HTMLDetailsElement;
	const summary = details.querySelector("summary") as HTMLElement;
	const content = summary.nextElementSibling as HTMLElement;
	const animations: TestAnimation[] = [];

	vi.stubGlobal(
		"matchMedia",
		vi.fn(() => ({ matches: false }) as MediaQueryList),
	);
	vi.spyOn(summary, "getBoundingClientRect").mockImplementation(
		() => ({ height: 48 }) as DOMRect,
	);
	vi.spyOn(details, "getBoundingClientRect").mockImplementation(
		() => ({ height: details.open ? 240 : 48 }) as DOMRect,
	);
	vi.spyOn(window, "getComputedStyle").mockImplementation(
		() =>
			({
				borderBottomWidth: "0px",
				borderTopWidth: "0px",
				paddingBottom: "0px",
				paddingTop: "0px",
			}) as CSSStyleDeclaration,
	);
	details.animate = vi.fn(
		(
			keyframes: Keyframe[] | PropertyIndexedKeyframes | null,
			timing?: number | KeyframeAnimationOptions,
		) => {
			const animation = {
				cancel: vi.fn(),
				keyframes: keyframes as Keyframe[],
				oncancel: null,
				onfinish: null,
				timing: timing as KeyframeAnimationOptions,
			} as unknown as TestAnimation;
			animations.push(animation);
			return animation;
		},
	);

	return { animations, content, details, summary };
};

describe("animatedDetails", () => {
	it("animates the complete disclosure and keeps content mounted through closing", () => {
		const { animations, content, details, summary } = createDisclosure();
		const action = animatedDetails(details);

		setAnimatedDetailsOpen(details, true);

		expect(details.open).toBe(true);
		expect(details).toHaveAttribute("data-expanded", "true");
		expect(summary).toHaveAttribute("aria-expanded", "true");
		expect(content.querySelector("input")).toHaveValue("Unsaved value");
		expect(animations[0].keyframes).toEqual([
			{ height: "48px", overflow: "hidden" },
			{ height: "240px", overflow: "hidden" },
		]);
		expect(animations[0].timing).toMatchObject({
			duration: 180,
			fill: "both",
		});
		animations[0].onfinish?.();

		setAnimatedDetailsOpen(details, false);

		expect(details.open).toBe(true);
		expect(details).toHaveAttribute("data-expanded", "false");
		expect(summary).toHaveAttribute("aria-expanded", "false");
		expect(content.querySelector("input")).toHaveValue("Unsaved value");
		expect(animations[1].keyframes).toEqual([
			{ height: "240px", overflow: "hidden" },
			{ height: "48px", overflow: "hidden" },
		]);
		animations[1].onfinish?.();
		expect(details.open).toBe(false);

		action.destroy?.();
	});

	it("includes disclosure padding and borders in the collapsed endpoint", () => {
		const { animations, details, summary } = createDisclosure();

		vi.spyOn(summary, "getBoundingClientRect").mockImplementation(
			() => ({ height: 36 }) as DOMRect,
		);
		vi.mocked(window.getComputedStyle).mockImplementation(
			() =>
				({
					borderBottomWidth: "1px",
					borderTopWidth: "1px",
					paddingBottom: "6px",
					paddingTop: "4px",
				}) as CSSStyleDeclaration,
		);

		const action = animatedDetails(details);
		setAnimatedDetailsOpen(details, true);

		expect(animations[0].keyframes[0]).toEqual({
			height: "48px",
			overflow: "hidden",
		});

		action.destroy?.();
	});

	it("reverses from the visible frame and ignores a stale finish callback", () => {
		const { animations, details } = createDisclosure(true);
		let currentAnimatedHeight: number | null = null;

		vi.spyOn(details, "getBoundingClientRect").mockImplementation(() => {
			if (currentAnimatedHeight !== null) {
				const height = currentAnimatedHeight;
				currentAnimatedHeight = null;
				return { height } as DOMRect;
			}
			return { height: details.open ? 240 : 48 } as DOMRect;
		});

		const action = animatedDetails(details);
		setAnimatedDetailsOpen(details, false);

		currentAnimatedHeight = 86;
		setAnimatedDetailsOpen(details, true);

		expect(animations[0].cancel).toHaveBeenCalledOnce();
		expect(animations[1].keyframes).toEqual([
			{ height: "86px", overflow: "hidden" },
			{ height: "240px", overflow: "hidden" },
		]);

		animations[0].onfinish?.();
		expect(details.open).toBe(true);
		animations[1].onfinish?.();
		expect(details.open).toBe(true);

		action.destroy?.();
	});

	it("changes immediately when reduced motion is requested", () => {
		const { details } = createDisclosure();

		vi.stubGlobal(
			"matchMedia",
			vi.fn(() => ({ matches: true }) as MediaQueryList),
		);

		const action = animatedDetails(details);
		setAnimatedDetailsOpen(details, true);

		expect(details.open).toBe(true);
		expect(details.animate).not.toHaveBeenCalled();

		setAnimatedDetailsOpen(details, false);
		expect(details.open).toBe(false);

		action.destroy?.();
	});
});
