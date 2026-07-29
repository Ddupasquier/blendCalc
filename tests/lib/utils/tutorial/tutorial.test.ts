import { describe, expect, it, vi } from "vitest";
import {
	CURRENT_TUTORIAL_VERSION,
	shouldAutomaticallyShowTutorial,
	writeTutorialChoice,
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
			"[data-tutorial-target='mix-ingredient-options'] .pill",
			"[data-tutorial-target='mix-goals'] .goal-input input",
			"[data-tutorial-target='mix-result-chart']",
			"[data-tutorial-target='saved-mix'] .saved-drink-card summary",
			"[data-tutorial-target='food-preferences'] .preference-editor-card:first-child",
		]);
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

	it("waits until the requested reminder time", () => {
		const remindAfter = "2026-06-20T12:00:00.000Z";
		const postponedPreference = preference({
			remind_after: remindAfter,
		});

		expect(
			shouldAutomaticallyShowTutorial(
				postponedPreference,
				new Date("2026-06-19T12:00:00.000Z"),
			),
		).toBe(false);
		expect(
			shouldAutomaticallyShowTutorial(
				postponedPreference,
				new Date("2026-06-20T12:00:00.000Z"),
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

describe("writeTutorialChoice", () => {
	it("stores a seven-day reminder without marking the tutorial complete", async () => {
		const upsert = vi.fn().mockResolvedValue({ error: null });
		const supabase = {
			from: vi.fn(() => ({ upsert })),
		};
		const now = new Date("2026-07-29T12:00:00.000Z");

		expect(
			await writeTutorialChoice(
				supabase as never,
				"user-1",
				"later",
				now,
			),
		).toBe(true);
		expect(upsert).toHaveBeenCalledWith(
			{
				user_id: "user-1",
				tutorial_version: CURRENT_TUTORIAL_VERSION,
				do_not_show_again: false,
				remind_after: "2026-08-05T12:00:00.000Z",
				last_seen_at: now.toISOString(),
				completed_at: null,
			},
			{ onConflict: "user_id" },
		);
	});

	it("records completion without a reminder", async () => {
		const upsert = vi.fn().mockResolvedValue({ error: null });
		const supabase = {
			from: vi.fn(() => ({ upsert })),
		};
		const now = new Date("2026-07-29T12:00:00.000Z");

		expect(
			await writeTutorialChoice(
				supabase as never,
				"user-1",
				"complete",
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
