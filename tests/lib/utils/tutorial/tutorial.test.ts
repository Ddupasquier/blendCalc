import { describe, expect, it, vi } from "vitest";
import {
	CURRENT_TUTORIAL_VERSION,
	shouldAutomaticallyShowTutorial,
	writeTutorialCompletion,
	type TutorialPreference,
} from "$lib/utils/tutorial/tutorial";
import { tutorialSteps } from "$lib/utils/tutorial/steps";

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
	it("uses the granular tutorial sequence for version 3", () => {
		expect(CURRENT_TUTORIAL_VERSION).toBe(3);
		expect(tutorialSteps).toHaveLength(9);
		expect(tutorialSteps.map((step) => step.target)).toEqual([
			"[data-tutorial-target='ingredient-search']",
			"[data-tutorial-target='ingredient-barcode']",
			"[data-tutorial-target='ingredient-card'] > .saved-ingredient-card",
			"[data-tutorial-target='ingredient-card'] button[aria-label^='Open actions for']",
			"[data-tutorial-target='mix-ingredient-options'] .mix-ingredient-option:first-child",
			"[data-tutorial-target='mix-goals'] .goal-input input",
			"[data-tutorial-target='mix-result-chart']",
			"[data-tutorial-target='saved-recipe'] .saved-recipe-card summary",
			"[data-tutorial-target='food-preferences'] .preference-reviewed-options:first-of-type label:first-child",
		]);
		expect(tutorialSteps.at(-1)?.route).toBe("/profile/food-preferences");
	});

	it("does not block the app when preferences cannot be loaded", () => {
		expect(shouldAutomaticallyShowTutorial(undefined)).toBe(false);
	});

	it("shows the tutorial when no preference exists", () => {
		expect(shouldAutomaticallyShowTutorial(null)).toBe(true);
	});

	it("does not automatically repeat after any current-version completion", () => {
		expect(
			shouldAutomaticallyShowTutorial(
				preference({ do_not_show_again: true }),
			),
		).toBe(false);
	});

	it("does not reopen legacy reminder rows", () => {
		expect(
			shouldAutomaticallyShowTutorial(
				preference({
					remind_after: "2026-06-20T12:00:00.000Z",
				}),
			),
		).toBe(false);
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

describe("writeTutorialCompletion", () => {
	it("records completion without a reminder", async () => {
		const upsert = vi.fn().mockResolvedValue({ error: null });
		const supabase = {
			from: vi.fn(() => ({ upsert })),
		};
		const now = new Date("2026-07-29T12:00:00.000Z");

		expect(
			await writeTutorialCompletion(
				supabase as never,
				"user-1",
				now,
			),
		).toBe(true);
		expect(upsert).toHaveBeenCalledWith(
			{
				user_id: "user-1",
				tutorial_version: CURRENT_TUTORIAL_VERSION,
				do_not_show_again: true,
				remind_after: null,
				last_seen_at: now.toISOString(),
				completed_at: now.toISOString(),
			},
			{ onConflict: "user_id" },
		);
	});
});
