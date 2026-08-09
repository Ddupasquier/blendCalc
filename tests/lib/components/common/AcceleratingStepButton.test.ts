import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import AcceleratingStepButton from "$lib/components/common/buttons/AcceleratingStepButton/AcceleratingStepButton.svelte";

afterEach(() => {
	vi.useRealTimers();
});

describe("AcceleratingStepButton", () => {
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

});
