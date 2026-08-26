import { describe, expect, it } from "vitest";
import {
	getAvailableProfilePrivilegedToolCount,
	getProfilePrivilegedToolTitle,
} from "$lib/utils/moderation/profilePrivilegedTools";

describe("Profile privileged tool presentation", () => {
	it.each([
		["moderator", "Moderator tools"],
		["admin", "Admin tools"],
		["developer", "Developer tools"],
	] as const)("uses the verified %s role title", (role, expectedTitle) => {
		expect(getProfilePrivilegedToolTitle(role)).toBe(expectedTitle);
	});

	it("counts only tool destinations granted by database permissions", () => {
		expect(
			getAvailableProfilePrivilegedToolCount([
				"moderation.access",
				"moderation.accounts.manage",
				"data_operations.catalog_health.read",
			]),
		).toBe(3);
		expect(
			getAvailableProfilePrivilegedToolCount([
				"moderation.access",
				"moderation.catalog.review",
			]),
		).toBe(2);
		expect(getAvailableProfilePrivilegedToolCount(["moderation.access"])).toBe(
			0,
		);
	});
});
