import type { Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "$lib/types/database.types";
import {
	CURRENT_TUTORIAL_VERSION,
} from "$lib/utils/tutorial/tutorial";
import { tutorialSteps } from "$lib/utils/tutorial/steps";
import {
	expect,
	test,
	waitForAppReady,
} from "./support/browserTest";
import { createAuthenticatedLocalQaDatabaseClient } from "./support/localQaDatabase";

type TutorialPreference = Tables<"user_tutorial_preferences">;

const readTutorialPreference = async (
	databaseClient: SupabaseClient<Database>,
	userId: string,
) => {
	const { data, error } = await databaseClient
		.from("user_tutorial_preferences")
		.select("*")
		.eq("user_id", userId)
		.maybeSingle();
	if (error) throw error;
	return data;
};

const writeTutorialPreference = async (
	databaseClient: SupabaseClient<Database>,
	preference: TutorialPreference,
) => {
	const { error } = await databaseClient
		.from("user_tutorial_preferences")
		.upsert(preference, { onConflict: "user_id" });
	if (error) throw error;
};

const getTutorialDatabaseFixture = async (parallelWorkerIndex: number) => {
	const databaseClient = await createAuthenticatedLocalQaDatabaseClient(
		parallelWorkerIndex,
	);
	const { data, error } = await databaseClient.auth.getUser();
	if (error || !data.user) {
		throw error ?? new Error("The tutorial QA account could not be authenticated.");
	}
	const originalPreference = await readTutorialPreference(
		databaseClient,
		data.user.id,
	);
	if (!originalPreference) {
		throw new Error("The tutorial QA account is missing its seeded preference.");
	}

	return {
		databaseClient,
		originalPreference,
		userId: data.user.id,
	};
};

const expectSpotlightAroundDirectTarget = async (page: Page) => {
	const activeTarget = page.locator("[data-tutorial-active='true']");
	const spotlight = page.locator(".tutorial-spotlight");
	await expect(activeTarget).toHaveCount(1);
	await expect(spotlight).toBeVisible();
	const [targetBounds, spotlightBounds] = await Promise.all([
		activeTarget.boundingBox(),
		spotlight.boundingBox(),
	]);
	expect(targetBounds).not.toBeNull();
	expect(spotlightBounds).not.toBeNull();
	expect(targetBounds!.width).toBeGreaterThan(0);
	expect(targetBounds!.height).toBeGreaterThan(0);
	expect(spotlightBounds!.width).toBeGreaterThan(0);
	expect(spotlightBounds!.height).toBeGreaterThan(0);
};

test("onboarding can be dismissed permanently without scheduling a reminder", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "desktop-chromium",
		"The database-backed onboarding write is verified once; shared tutorial controls have cross-engine component coverage.",
	);

	const fixture = await getTutorialDatabaseFixture(testInfo.parallelIndex);
	try {
		await writeTutorialPreference(fixture.databaseClient, {
			...fixture.originalPreference,
			tutorial_version: CURRENT_TUTORIAL_VERSION - 1,
			do_not_show_again: false,
			remind_after: null,
			completed_at: null,
		});

		await page.goto("/ingredients/fridge");
		await waitForAppReady(page);
		const dialog = page.getByRole("dialog");
		await expect(dialog).toBeVisible();
		await expect(
			page.getByRole("heading", { name: "Find the foods you use" }),
		).toBeVisible();
		await expectSpotlightAroundDirectTarget(page);
		await expect(page.locator(".app-main")).toHaveAttribute("inert", "");
		await expect(page.locator("html")).toHaveCSS("overflow", "hidden");
		await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
		await expect(
			dialog.getByRole("button", { name: "Remind me in 7 days" }),
		).toHaveCount(0);

		const [targetBounds, spotlightBounds, viewFrameBounds] =
			await Promise.all([
				page.locator("[data-tutorial-active='true']").boundingBox(),
				page.locator(".tutorial-spotlight").boundingBox(),
				page.locator(".view-frame").boundingBox(),
			]);
		expect(targetBounds).not.toBeNull();
		expect(spotlightBounds).not.toBeNull();
		expect(viewFrameBounds).not.toBeNull();
		expect(targetBounds!.x - spotlightBounds!.x).toBeGreaterThanOrEqual(8);
		expect(targetBounds!.y - spotlightBounds!.y).toBeGreaterThanOrEqual(8);
		expect(spotlightBounds!.x).toBeGreaterThanOrEqual(viewFrameBounds!.x);
		expect(spotlightBounds!.x + spotlightBounds!.width).toBeLessThanOrEqual(
			viewFrameBounds!.x + viewFrameBounds!.width,
		);
		await expect
			.poll(async () => {
				const [currentSpotlightBounds, dialogBounds] = await Promise.all([
					page.locator(".tutorial-spotlight").boundingBox(),
					dialog.boundingBox(),
				]);
				if (!currentSpotlightBounds || !dialogBounds) return false;
				return (
					dialogBounds.x + dialogBounds.width <= currentSpotlightBounds.x ||
					dialogBounds.x >=
						currentSpotlightBounds.x + currentSpotlightBounds.width ||
					dialogBounds.y + dialogBounds.height <= currentSpotlightBounds.y ||
					dialogBounds.y >=
						currentSpotlightBounds.y + currentSpotlightBounds.height
				);
			})
			.toBe(true);

		await page.keyboard.press("Tab");
		expect(
			await dialog.evaluate((element) =>
				element.contains(document.activeElement),
			),
		).toBe(true);

		await dialog.getByRole("button", { name: "Don’t show again" }).click();
		await expect(dialog).toHaveCount(0);
		await expect(page.locator(".app-main")).not.toHaveAttribute("inert", "");
		await expect
			.poll(async () =>
				readTutorialPreference(fixture.databaseClient, fixture.userId),
			)
			.toMatchObject({
				tutorial_version: CURRENT_TUTORIAL_VERSION,
				do_not_show_again: true,
				remind_after: null,
			});
		const savedPreference = await readTutorialPreference(
			fixture.databaseClient,
			fixture.userId,
		);
		expect(savedPreference?.completed_at).not.toBeNull();

		await page.reload();
		await waitForAppReady(page);
		await expect(page.getByRole("dialog")).toHaveCount(0);
	} finally {
		await writeTutorialPreference(
			fixture.databaseClient,
			fixture.originalPreference,
		);
	}
});

test("Profile replay visits every direct tutorial target without changing completion", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "desktop-chromium",
		"The complete route-aware tour is deterministic in one browser; shared controls are covered cross-engine elsewhere.",
	);

	const fixture = await getTutorialDatabaseFixture(testInfo.parallelIndex);
	try {
		await page.goto("/profile");
		await waitForAppReady(page);
		await page.getByRole("link", { name: "Open guided tutorial" }).click();

		const dialog = page.getByRole("dialog");
		await expect(dialog).toBeVisible();
		await expect(
			dialog.getByRole("button", { name: "Remind me in 7 days" }),
		).toHaveCount(0);

		for (let index = 0; index < tutorialSteps.length; index += 1) {
			const step = tutorialSteps[index];
			await expect(page).toHaveURL(new RegExp(`${step.route}$`));
			await expect(
				page.getByRole("heading", { name: step.title }),
			).toBeVisible();
			await expectSpotlightAroundDirectTarget(page);
			await expect(page.locator(".app-main")).toHaveAttribute("inert", "");
			if (index < tutorialSteps.length - 1) {
				await dialog.getByRole("button", { name: "Next" }).click();
			}
		}

		await dialog.getByRole("button", { name: "Previous" }).click();
		await expect(page).toHaveURL(/\/saved$/);
		await expect(
			page.getByRole("heading", { name: "Reopen a saved combination" }),
		).toBeVisible();
		await expectSpotlightAroundDirectTarget(page);
		await dialog.getByRole("button", { name: "Next" }).click();
		await expect(page).toHaveURL(/\/profile\/food-preferences$/);

		await dialog.getByRole("button", { name: "Exit tour" }).click();
		await expect(page).toHaveURL(/\/profile$/);
		await expect(page.getByRole("dialog")).toHaveCount(0);
		await expect(page.locator(".app-main")).not.toHaveAttribute("inert", "");
		expect(
			await readTutorialPreference(fixture.databaseClient, fixture.userId),
		).toEqual(fixture.originalPreference);
	} finally {
		await writeTutorialPreference(
			fixture.databaseClient,
			fixture.originalPreference,
		);
	}
});

test("legacy reminder rows stay closed and signed-out completion writes are rejected", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "desktop-chromium",
		"The legacy-state and authentication boundaries are browser-independent server behavior.",
	);

	const fixture = await getTutorialDatabaseFixture(testInfo.parallelIndex);
	try {
		await writeTutorialPreference(fixture.databaseClient, {
			...fixture.originalPreference,
			tutorial_version: CURRENT_TUTORIAL_VERSION,
			do_not_show_again: false,
			remind_after: "2026-07-01T00:00:00.000Z",
			completed_at: null,
		});
		await page.goto("/ingredients/fridge");
		await waitForAppReady(page);
		await expect(page.getByRole("dialog")).toHaveCount(0);

		await page.context().clearCookies();
		const response = await page.request.post("/api/tutorial-preference", {
			data: { choice: "complete" },
		});
		expect(response.status()).toBe(401);
	} finally {
		await writeTutorialPreference(
			fixture.databaseClient,
			fixture.originalPreference,
		);
	}
});
