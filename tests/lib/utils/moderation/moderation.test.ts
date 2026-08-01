import { describe, expect, it } from "vitest";
import {
	canModerateTargetRole,
	getElevatedAppRole,
	isActiveAccountBlock,
	normalizeAppRoleClaim,
} from "$lib/utils/moderation/moderation";

describe("application role claims", () => {
	it("accepts only database-defined application roles", () => {
		expect(normalizeAppRoleClaim("user")).toBe("user");
		expect(normalizeAppRoleClaim("moderator")).toBe("moderator");
		expect(normalizeAppRoleClaim("admin")).toBe("admin");
		expect(normalizeAppRoleClaim("owner")).toBeNull();
		expect(normalizeAppRoleClaim(null)).toBeNull();
	});

	it("keeps normal users out of elevated role checks", () => {
		expect(getElevatedAppRole("user")).toBeNull();
		expect(getElevatedAppRole("moderator")).toBe("moderator");
		expect(getElevatedAppRole("admin")).toBe("admin");
	});
});

describe("moderation permissions", () => {
	it("lets moderators act only on normal users", () => {
		expect(canModerateTargetRole("moderator", null)).toBe(true);
		expect(canModerateTargetRole("moderator", "moderator")).toBe(false);
		expect(canModerateTargetRole("moderator", "admin")).toBe(false);
	});

	it("lets admins act on moderators but not admins", () => {
		expect(canModerateTargetRole("admin", null)).toBe(true);
		expect(canModerateTargetRole("admin", "moderator")).toBe(true);
		expect(canModerateTargetRole("admin", "admin")).toBe(false);
	});
});

describe("account block status", () => {
	it("treats bans as active without an expiration", () => {
		expect(isActiveAccountBlock("banned", null)).toBe(true);
	});

	it("expires suspensions after their timestamp", () => {
		expect(isActiveAccountBlock("suspended", "2026-06-15T00:00:00Z", 0)).toBe(true);
		expect(
			isActiveAccountBlock("suspended", "2026-06-15T00:00:00Z", Date.parse("2026-06-16")),
		).toBe(false);
	});
});
