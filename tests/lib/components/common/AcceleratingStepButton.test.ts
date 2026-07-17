import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import AcceleratingStepButton from "$lib/components/common/buttons/AcceleratingStepButton.svelte";

afterEach(() => {
	vi.useRealTimers();
});

describe("AcceleratingStepButton", () => {
	it("uses one step for an ordinary click", async () => {
		const onStep = vi.fn();
		render(AcceleratingStepButton, {
			props: { label: "Increase amount", onStep },
		});

		await fireEvent.click(screen.getByRole("button", { name: "Increase amount" }));
		expect(onStep).toHaveBeenCalledTimes(1);
		expect(onStep).toHaveBeenCalledWith(1);
	});

	it("accelerates continuously while pointer input remains held", async () => {
		vi.useFakeTimers();
		const onStep = vi.fn();
		render(AcceleratingStepButton, {
			props: { label: "Increase amount", onStep },
		});
		const button = screen.getByRole("button", { name: "Increase amount" });

		await fireEvent.pointerDown(button, {
			button: 0,
			pointerId: 1,
			pointerType: "mouse",
		});
		expect(onStep.mock.calls.map(([step]) => step)).toEqual([1]);

		vi.advanceTimersByTime(999);
		expect(onStep).toHaveBeenCalledTimes(1);
		vi.advanceTimersByTime(1);
		expect(onStep).toHaveBeenLastCalledWith(2);

		vi.advanceTimersByTime(1000);
		expect(onStep).toHaveBeenLastCalledWith(5);
		vi.advanceTimersByTime(1000);
		expect(onStep).toHaveBeenLastCalledWith(10);
		vi.advanceTimersByTime(1000);
		expect(onStep).toHaveBeenLastCalledWith(50);

		await fireEvent.pointerUp(button, { pointerId: 1, pointerType: "mouse" });
		const callCountAfterRelease = onStep.mock.calls.length;
		vi.advanceTimersByTime(1000);
		expect(onStep).toHaveBeenCalledTimes(callCountAfterRelease);
	});

	it("supports the same hold behavior from the keyboard", async () => {
		vi.useFakeTimers();
		const onStep = vi.fn();
		render(AcceleratingStepButton, {
			props: { label: "Decrease amount", onStep },
		});
		const button = screen.getByRole("button", { name: "Decrease amount" });

		await fireEvent.keyDown(button, { key: " " });
		expect(onStep).toHaveBeenLastCalledWith(1);
		vi.advanceTimersByTime(1000);
		expect(onStep).toHaveBeenLastCalledWith(2);

		await fireEvent.keyUp(button, { key: " " });
		const callCountAfterRelease = onStep.mock.calls.length;
		vi.advanceTimersByTime(1000);
		expect(onStep).toHaveBeenCalledTimes(callCountAfterRelease);
	});
});
