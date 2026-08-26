import { describe, expect, it } from "vitest";
import {
	getProfileSettingsRoute,
	getProfileSettingsRouteHref,
	getProfileSettingsRouteTitle,
	PROFILE_SETTINGS_ROUTES,
} from "$lib/utils/profile/profileRouteState";

describe("Profile settings routes", () => {
	it("recognizes every supported Profile settings route", () => {
		for (const settingsRoute of Object.values(PROFILE_SETTINGS_ROUTES)) {
			const href = getProfileSettingsRouteHref(settingsRoute);
			expect(getProfileSettingsRoute(href)).toBe(settingsRoute);
		}
	});

	it("keeps unsupported paths out of Profile overlay state", () => {
		expect(getProfileSettingsRoute("/profile")).toBeNull();
		expect(getProfileSettingsRoute("/profile/not-a-setting")).toBeNull();
	});

	it("provides concise titles for direct settings routes", () => {
		expect(getProfileSettingsRouteTitle("/profile/appearance")).toBe(
			"Light/Dark Mode",
		);
		expect(getProfileSettingsRouteTitle("/profile/playful-messages")).toBe(
			"Playful Messages",
		);
		expect(getProfileSettingsRouteTitle("/profile/details")).toBe(
			"Profile Details",
		);
		expect(getProfileSettingsRouteTitle("/profile/image")).toBe(
			"Profile Image",
		);
		expect(getProfileSettingsRouteTitle("/profile/privileged-tools")).toBe(
			"Privileged Tools",
		);
		expect(
			getProfileSettingsRouteTitle(
				"/profile/privileged-tools/product-submissions",
			),
		).toBe("Product Submissions");
		expect(
			getProfileSettingsRouteTitle(
				"/profile/privileged-tools/catalog-review-work",
			),
		).toBe("Catalog Review Work");
		expect(
			getProfileSettingsRouteTitle("/profile/privileged-tools/data-operations"),
		).toBe("Data Operations");
		expect(getProfileSettingsRouteTitle("/profile")).toBe("Profile");
	});
});
