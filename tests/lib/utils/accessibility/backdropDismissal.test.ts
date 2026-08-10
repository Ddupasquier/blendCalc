import { describe, expect, it, vi } from "vitest";
import { createBackdropDismissal } from "$lib/utils/accessibility/backdropDismissal";

const createPointerEvent = ({
	pointerId = 1,
	clientX = 20,
	clientY = 20,
	button = 0,
	isPrimary = true,
	sameTarget = true,
}: {
	pointerId?: number;
	clientX?: number;
	clientY?: number;
	button?: number;
	isPrimary?: boolean;
	sameTarget?: boolean;
} = {}) => {
	const currentTarget = {};
	return {
		button,
		clientX,
		clientY,
		currentTarget,
		isPrimary,
		pointerId,
		target: sameTarget ? currentTarget : {},
	} as unknown as PointerEvent;
};

describe("backdrop dismissal", () => {
	it("dismisses only after a complete backdrop press", () => {
		const onDismiss = vi.fn();
		const dismissal = createBackdropDismissal({
			canDismiss: () => true,
			onDismiss,
		});
		const event = createPointerEvent();

		dismissal.handleBackdropPointerDown(event);
		expect(onDismiss).not.toHaveBeenCalled();

		dismissal.handleBackdropPointerUp(event);
		expect(onDismiss).toHaveBeenCalledOnce();
	});

	it("does not dismiss when returning from another window", () => {
		const onDismiss = vi.fn();
		const dismissal = createBackdropDismissal({
			canDismiss: () => true,
			onDismiss,
		});
		const event = createPointerEvent();

		dismissal.handleWindowBlur();
		dismissal.handleBackdropPointerDown(event);
		dismissal.handleBackdropPointerUp(event);
		expect(onDismiss).not.toHaveBeenCalled();

		dismissal.handleBackdropPointerDown(event);
		dismissal.handleBackdropPointerUp(event);
		expect(onDismiss).toHaveBeenCalledOnce();
	});

	it("does not dismiss for a drag, secondary press, or sheet press", () => {
		const onDismiss = vi.fn();
		const dismissal = createBackdropDismissal({
			canDismiss: () => true,
			onDismiss,
		});

		dismissal.handleBackdropPointerDown(createPointerEvent());
		dismissal.handleBackdropPointerUp(createPointerEvent({ clientX: 40 }));

		const secondaryEvent = createPointerEvent({ button: 2 });
		dismissal.handleBackdropPointerDown(secondaryEvent);
		dismissal.handleBackdropPointerUp(secondaryEvent);

		dismissal.handleWindowBlur();
		dismissal.handleSheetPointerDown();
		dismissal.handleBackdropPointerUp(createPointerEvent());

		expect(onDismiss).not.toHaveBeenCalled();
	});
});
