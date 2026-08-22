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

	it("counts only reported profile images instead of ordinary uploads", () => {
		const summaryReader = readSource(
			"src/lib/server/moderation/moderatorActionSummary.server.ts",
		);

		expect(summaryReader).toContain(
			'admin.rpc("get_pending_profile_image_review_count")',
		);
		expect(summaryReader).not.toContain('.from("profiles")');
	});

	it("keeps profile-image reports separate from account moderation", () => {
		const workspaceServer = readSource(
			"src/lib/server/moderation/moderationWorkspace.server.ts",
		);
		const workspaceView = readSource(
			"src/lib/components/moderation/ModerationWorkspace/ModerationWorkspace.svelte",
		);
		const profileImageRoute = readSource(
			"src/routes/profile/moderator-actions/profile-images/+page.server.ts",
		);

		expect(workspaceServer).toContain("listPendingProfileImageReports");
		expect(workspaceServer).toContain(
			'scope === "all" || scope === "account-access"',
		);
		expect(workspaceView).toContain("ProfileImageReportReviewList");
		expect(workspaceView).toContain("AccountAccessReviewList");
		expect(profileImageRoute).toContain("reviewProfileImageReport");
		expect(profileImageRoute).not.toContain("moderationWorkspaceActions.ban");
	});

	it("uses one reusable help sheet across every focused moderator destination", () => {
		const rightSheet = readSource(
			"src/lib/components/moderation/ModeratorActionRightSheet/ModeratorActionRightSheet.svelte",
		);
		const informationSheet = readSource(
			"src/lib/components/moderation/ModeratorActionInformationSheet/ModeratorActionInformationSheet.svelte",
		);

		expect(rightSheet).toContain("ModeratorActionInformationSheet");
		expect(rightSheet).toContain("CircleIconButton");
		expect(informationSheet).toContain("<BottomSheet");

		for (const routeName of [
			"product-submissions",
			"food-warning-reports",
			"profile-images",
			"account-access",
			"catalog-data-health",
		]) {
			const route = readSource(
				`src/routes/profile/moderator-actions/${routeName}/+page.svelte`,
			);
			expect(route).toContain(`informationKey="${routeName}"`);
		}
	});

	it("keeps each review domain in a focused component", () => {
		const workspaceView = readSource(
			"src/lib/components/moderation/ModerationWorkspace/ModerationWorkspace.svelte",
		);

		for (const componentName of [
			"ProductSubmissionReviewList",
			"FoodWarningReportReviewList",
			"ProfileImageReportReviewList",
			"AccountAccessReviewList",
		]) {
			expect(workspaceView).toContain(componentName);
		}
		expect(workspaceView).not.toContain("<article");
		expect(workspaceView).not.toContain("<form");
	});
});
