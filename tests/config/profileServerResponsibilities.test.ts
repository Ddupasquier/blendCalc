import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(path, "utf8");

describe("Profile server responsibilities", () => {
	it("keeps the route focused on composing its public action contract", () => {
		const profileRoute = readSource("src/routes/profile/+page.server.ts");

		for (const [actionName, actionHandler] of [
			["savePlayfulMessages", "savePlayfulMessagesPreference"],
			["saveAppearance", "saveProfileAppearance"],
			["saveProfile", "saveProfileDetails"],
			["saveFoodPreferences", "saveProfileFoodPreferences"],
			["uploadAvatar", "uploadProfileImage"],
			["removeAvatar", "removeProfileImage"],
		] as const) {
			expect(profileRoute).toContain(`${actionName}: ${actionHandler}`);
		}

		expect(profileRoute).not.toContain("readLimitedFormData");
		expect(profileRoute).not.toContain(".from(");
		expect(profileRoute).not.toContain("normalizeImageUpload");
	});

	it("keeps account, food-preference, and image workflows independent", () => {
		const accountSettingsActions = readSource(
			"src/lib/server/profile/profileAccountSettingsActions.server.ts",
		);
		const foodPreferenceActions = readSource(
			"src/lib/server/profile/profileFoodPreferenceActions.server.ts",
		);
		const imageActions = readSource(
			"src/lib/server/profile/profileImageActions.server.ts",
		);

		expect(accountSettingsActions).toContain("saveProfileDetails");
		expect(accountSettingsActions).toContain("saveProfileAppearance");
		expect(accountSettingsActions).toContain("savePlayfulMessagesPreference");
		expect(accountSettingsActions).not.toContain("user_food_preferences");
		expect(accountSettingsActions).not.toContain("normalizeImageUpload");

		expect(foodPreferenceActions).toContain("saveProfileFoodPreferences");
		expect(foodPreferenceActions).toContain("user_food_preferences");
		expect(foodPreferenceActions).not.toContain("THEME_PREFERENCE_COOKIE");
		expect(foodPreferenceActions).not.toContain("PROFILE_AVATAR_BUCKET");

		expect(imageActions).toContain("uploadProfileImage");
		expect(imageActions).toContain("removeProfileImage");
		expect(imageActions).toContain("normalizeImageUpload");
		expect(imageActions).not.toContain("user_food_preferences");
		expect(imageActions).not.toContain("THEME_PREFERENCE_COOKIE");
	});
});
