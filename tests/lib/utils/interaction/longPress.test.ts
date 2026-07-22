import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { longPress } from "$lib/utils/interaction/longPress";

const pointerEvent = (
	type: string,
	options: Partial<PointerEvent> = {},
) => {
	const event = new MouseEvent(type, {
		bubbles: true,
		button: options.button ?? 0,
		clientX: options.clientX ?? 0,
		clientY: options.clientY ?? 0,
	});
	Object.defineProperties(event, {
		isPrimary: { value: options.isPrimary ?? true },
		pointerId: { value: options.pointerId ?? 1 },
		pointerType: { value: options.pointerType ?? "touch" },
	});
	return event;
};

describe("longPress", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("activates once after a deliberate hold and suppresses the following click", () => {
		const button = document.createElement("button");
		const onLongPress = vi.fn();
		const onClick = vi.fn();
		button.addEventListener("click", onClick);
		const action = longPress(button, { onLongPress });

		button.dispatchEvent(pointerEvent("pointerdown"));
		vi.advanceTimersByTime(500);
		button.dispatchEvent(pointerEvent("pointerup"));
		button.click();

		expect(onLongPress).toHaveBeenCalledOnce();
		expect(onClick).not.toHaveBeenCalled();
		action.destroy();
	});

	it("cancels when the pointer moves far enough to be a scroll", () => {
		const button = document.createElement("button");
		const onLongPress = vi.fn();
		const action = longPress(button, { onLongPress });

		button.dispatchEvent(pointerEvent("pointerdown"));
		button.dispatchEvent(pointerEvent("pointermove", { clientY: 20 }));
		vi.advanceTimersByTime(500);

		expect(onLongPress).not.toHaveBeenCalled();
		action.destroy();
	});

	it("still suppresses the follow-up click when activation disables further holds", () => {
		const button = document.createElement("button");
		const onClick = vi.fn();
		button.addEventListener("click", onClick);
		let action: ReturnType<typeof longPress>;
		const onLongPress = vi.fn(() => {
			action.update({ onLongPress, disabled: true });
		});
		action = longPress(button, { onLongPress });

		button.dispatchEvent(pointerEvent("pointerdown"));
		vi.advanceTimersByTime(500);
		button.dispatchEvent(pointerEvent("pointerup"));
		button.click();

		expect(onLongPress).toHaveBeenCalledOnce();
		expect(onClick).not.toHaveBeenCalled();
		action.destroy();
	});

	it("does nothing while disabled", () => {
		const button = document.createElement("button");
		const onLongPress = vi.fn();
		const action = longPress(button, { onLongPress, disabled: true });

		button.dispatchEvent(pointerEvent("pointerdown"));
		vi.advanceTimersByTime(500);

		expect(onLongPress).not.toHaveBeenCalled();
		action.destroy();
	});
});
