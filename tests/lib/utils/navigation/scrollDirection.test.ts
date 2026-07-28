import { describe, expect, it } from "vitest";
import { createScrollDirectionTracker } from "$lib/utils/navigation/scrollDirection";

describe("scroll direction tracker", () => {
	it("waits for deliberate downward movement before hiding", () => {
		const tracker = createScrollDirectionTracker();

		expect(tracker.update(8)).toBeNull();
		expect(tracker.update(20)).toBeNull();
		expect(tracker.update(25)).toBe("down");
		expect(tracker.update(80)).toBeNull();
	});

	it("reveals after upward movement without requiring the top boundary", () => {
		const tracker = createScrollDirectionTracker();

		expect(tracker.update(30)).toBe("down");
		expect(tracker.update(24)).toBeNull();
		expect(tracker.update(17)).toBe("up");
	});

	it("always reveals when scrolling returns to the top", () => {
		const tracker = createScrollDirectionTracker();

		expect(tracker.update(40)).toBe("down");
		expect(tracker.update(3)).toBe("up");
		expect(tracker.update(Number.NaN)).toBeNull();
	});

	it("resets to a visible state for a newly selected list", () => {
		const tracker = createScrollDirectionTracker();

		expect(tracker.update(40)).toBe("down");
		tracker.reset();
		expect(tracker.update(8)).toBeNull();
		expect(tracker.update(26)).toBe("down");
	});
});
