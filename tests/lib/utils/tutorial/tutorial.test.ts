import { describe, expect, it } from "vitest";
import {
	CURRENT_TUTORIAL_VERSION,
	shouldAutomaticallyShowTutorial,
	type TutorialPreference,
} from "$lib/utils/tutorial/tutorial";

const preference = (
	overrides: Partial<TutorialPreference> = {},
): TutorialPreference => ({
	user_id: "user-1",
	tutorial_version: CURRENT_TUTORIAL_VERSION,
	do_not_show_again: false,
	remind_after: null,
	last_seen_at: "2026-06-13T12:00:00.000Z",
	completed_at: null,
	created_at: "2026-06-13T12:00:00.000Z",
	updated_at: "2026-06-13T12:00:00.000Z",
	...overrides,
});

describe("shouldAutomaticallyShowTutorial", () => {
	it("does not block the app when preferences cannot be loaded", () => {
		expect(shouldAutomaticallyShowTutorial(undefined)).toBe(false);
	});

	it("shows the tutorial when no preference exists", () => {
		expect(shouldAutomaticallyShowTutorial(null)).toBe(true);
	});

	it("does not automatically show after the user opts out", () => {
		expect(
			shouldAutomaticallyShowTutorial(
				preference({ do_not_show_again: true }),
			),
		).toBe(false);
	});

	it("waits until a reminder date is due", () => {
		const now = new Date("2026-06-13T12:00:00.000Z");

		expect(
			shouldAutomaticallyShowTutorial(
				preference({ remind_after: "2026-06-20T12:00:00.000Z" }),
				now,
			),
		).toBe(false);

		expect(
			shouldAutomaticallyShowTutorial(
				preference({ remind_after: "2026-06-12T12:00:00.000Z" }),
				now,
			),
		).toBe(true);
	});

	it("shows a newer tutorial version once", () => {
		expect(
			shouldAutomaticallyShowTutorial(
				preference({
					tutorial_version: CURRENT_TUTORIAL_VERSION - 1,
					do_not_show_again: true,
				}),
			),
		).toBe(true);
	});
});
