import { describe, expect, it } from "vitest";
import { getLinearNavigationIndex } from "$lib/utils/accessibility/keyboardNavigation";

describe("linear keyboard navigation", () => {
	it("supports arrows, Home, End, and wrapping", () => {
		expect(getLinearNavigationIndex("ArrowRight", 0, 2)).toBe(1);
		expect(getLinearNavigationIndex("ArrowRight", 1, 2)).toBe(0);
		expect(getLinearNavigationIndex("ArrowLeft", 0, 2)).toBe(1);
		expect(getLinearNavigationIndex("Home", 1, 2)).toBe(0);
		expect(getLinearNavigationIndex("End", 0, 2)).toBe(1);
		expect(getLinearNavigationIndex("Enter", 0, 2)).toBeNull();
	});
});
