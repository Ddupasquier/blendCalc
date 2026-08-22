import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(path, "utf8");

describe("Profile moderator action architecture", () => {
	it("uses focused Profile routes instead of hash jumps into one page", () => {
		const actionSheet = readSource(
			"src/lib/components/profile/ProfileModeratorActionSheet/ProfileModeratorActionSheet.svelte",
		);
		const routeState = readSource(
			"src/lib/utils/profile/profileRouteState.ts",
		);

		for (const routeName of [
			"product-submissions",
			"food-warning-reports",
			"profile-images",
			"account-access",
			"catalog-data-health",
		]) {
			expect(routeState).toContain(`moderator-actions/${routeName}`);
		}
		expect(actionSheet).not.toContain("/moderation#");
	});

	it("loads only the data domain owned by each focused moderation route", () => {
		const routeScopes = [
			["product-submissions", "product-submissions"],
			["food-warning-reports", "food-warning-reports"],
			["profile-images", "profile-images"],
			["account-access", "account-access"],
		] as const;

		for (const [routeName, expectedScope] of routeScopes) {
			const source = readSource(
				`src/routes/profile/moderator-actions/${routeName}/+page.server.ts`,
			);
			expect(source).toContain(`routePath, "${expectedScope}"`);
		}
	});

	it("counts the profile-image state that uploads actually create", () => {
		const summaryReader = readSource(
			"src/lib/server/moderation/moderatorActionSummary.server.ts",
		);

		expect(summaryReader).toContain(
			'.eq("avatar_moderation_status", "self_attested")',
		);
		expect(summaryReader).not.toContain(
			'.eq("avatar_moderation_status", "pending")',
		);
	});
});
