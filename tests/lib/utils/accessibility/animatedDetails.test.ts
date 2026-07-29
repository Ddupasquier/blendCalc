import { afterEach, describe, expect, it, vi } from "vitest";
import {
	animatedDetails,
	setAnimatedDetailsOpen,
} from "$lib/utils/accessibility/animatedDetails";

afterEach(() => {
	document.body.replaceChildren();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("animatedDetails", () => {
	it("animates both directions and keeps content mounted until closing finishes", () => {
		document.body.innerHTML = `
			<details>
				<summary>Details</summary>
				<div><input value="Unsaved value" /></div>
			</details>
		`;
		const details = document.querySelector("details") as HTMLDetailsElement;
		const summary = details.querySelector("summary") as HTMLElement;
		const content = summary.nextElementSibling as HTMLElement;
		const animations: Array<Animation & { onfinish: (() => void) | null }> = [];

		vi.stubGlobal(
			"matchMedia",
			vi.fn(() => ({ matches: false }) as MediaQueryList),
		);
		content.animate = vi.fn(() => {
			const animation = {
				cancel: vi.fn(),
				onfinish: null,
			} as unknown as Animation & { onfinish: (() => void) | null };
			animations.push(animation);
			return animation;
		});

		const action = animatedDetails(details);
		setAnimatedDetailsOpen(details, true);

		expect(details.open).toBe(true);
		expect(details).toHaveAttribute("data-expanded", "true");
		expect(summary).toHaveAttribute("aria-expanded", "true");
		expect(content.querySelector("input")).toHaveValue("Unsaved value");
		animations[0].onfinish?.();

		setAnimatedDetailsOpen(details, false);

		expect(details.open).toBe(true);
		expect(details).toHaveAttribute("data-expanded", "false");
		expect(summary).toHaveAttribute("aria-expanded", "false");
		expect(content.querySelector("input")).toHaveValue("Unsaved value");
		animations[1].onfinish?.();
		expect(details.open).toBe(false);

		action.destroy?.();
	});
});
