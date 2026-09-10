import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(path, "utf8");

describe("Profile privileged tools architecture", () => {
	it("uses focused Profile routes instead of hash jumps into one page", () => {
		const actionSheet = readSource(
			"src/lib/components/profile/ProfilePrivilegedToolsSheet/ProfilePrivilegedToolsSheet.svelte",
		);
		const routeState = readSource("src/lib/utils/profile/profileRouteState.ts");

		for (const routeName of [
			"product-submissions",
			"food-warning-reports",
			"profile-images",
			"account-access",
			"catalog-review-work",
			"data-operations",
		]) {
			expect(routeState).toContain(`privileged-tools/${routeName}`);
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
				`src/routes/profile/privileged-tools/${routeName}/+page.server.ts`,
			);
			expect(source).toContain(`routePath, "${expectedScope}"`);
		}
	});

	it("enforces exact DB-owned permissions at focused loads and mutations", () => {
		const accessGuard = readSource(
			"src/lib/server/moderation/moderationAccess.server.ts",
		);
		const workspaceServer = readSource(
			"src/lib/server/moderation/moderationWorkspace.server.ts",
		);
		const catalogReviewServer = readSource(
			"src/lib/server/moderation/catalogReviewWorkWorkspace.server.ts",
		);
		const dataOperationsServer = readSource(
			"src/lib/server/moderation/catalogDataOperationsWorkspace.server.ts",
		);

		expect(accessGuard).toContain("readAppRolePermissions");
		expect(accessGuard).toContain("permissions.includes(permission)");
		for (const permission of [
			"moderation.accounts.manage",
			"moderation.catalog.review",
			"moderation.warnings.review",
		]) {
			expect(workspaceServer).toContain(permission);
		}
		expect(catalogReviewServer).toContain("moderation.catalog.review");
		expect(catalogReviewServer).not.toContain(
			"data_operations.catalog_health.read",
		);
		expect(dataOperationsServer).toContain(
			"data_operations.catalog_health.read",
		);
		expect(dataOperationsServer).not.toContain("moderation.catalog.review");
	});

	it("loads every role-aware actionable count through one guarded RPC", () => {
		const summaryReader = readSource(
			"src/lib/server/moderation/privilegedToolReviewSummary.server.ts",
		);
		const migration = readSource(
			"supabase/migrations/20260908220000_privileged_tool_action_summary.sql",
		);

		expect(summaryReader).toContain('"get_privileged_tool_action_summary"');
		expect(summaryReader).not.toContain("getSupabaseAdminClient");
		expect(migration).toContain("auth.jwt() ->> 'aal'");
		expect(migration).toContain("public.app_role_assignments");
		expect(migration).toContain("public.profile_image_reports");
		expect(migration).toContain("public.catalog_health_issue_occurrences");
		expect(migration).not.toContain("from public.profiles");
	});

	it("keeps profile-image reports separate from account moderation", () => {
		const workspaceServer = readSource(
			"src/lib/server/moderation/moderationWorkspace.server.ts",
		);
		const profileImageRoute = readSource(
			"src/routes/profile/privileged-tools/profile-images/+page.server.ts",
		);
		const profileImageView = readSource(
			"src/routes/profile/privileged-tools/profile-images/+page.svelte",
		);
		const accountAccessView = readSource(
			"src/routes/profile/privileged-tools/account-access/+page.svelte",
		);

		expect(workspaceServer).toContain("listPendingProfileImageReports");
		expect(workspaceServer).toContain('scope === "account-access"');
		expect(workspaceServer).not.toContain('scope === "all"');
		expect(profileImageView).toContain("ProfileImageReportReviewList");
		expect(profileImageView).not.toContain("AccountAccessReviewList");
		expect(accountAccessView).toContain("AccountAccessReviewList");
		expect(accountAccessView).not.toContain("ProfileImageReportReviewList");
		expect(profileImageRoute).toContain("reviewProfileImageReport");
		expect(profileImageRoute).not.toContain("moderationWorkspaceActions.ban");
	});

	it("redirects the legacy combined workspace to the role-aware gateway", () => {
		const legacyRoute = readSource("src/routes/moderation/+page.server.ts");

		expect(legacyRoute).toContain('redirect(308, "/profile/privileged-tools")');
		expect(legacyRoute).not.toContain("moderationWorkspaceActions");
	});

	it("uses one reusable help sheet across every focused privileged tool", () => {
		const rightSheet = readSource(
			"src/lib/components/moderation/PrivilegedToolRightSheet/PrivilegedToolRightSheet.svelte",
		);
		const informationSheet = readSource(
			"src/lib/components/moderation/PrivilegedToolInformationSheet/PrivilegedToolInformationSheet.svelte",
		);

		expect(rightSheet).toContain("PrivilegedToolInformationSheet");
		expect(rightSheet).toContain("CircleIconButton");
		expect(informationSheet).toContain("<BottomSheet");

		for (const routeName of [
			"product-submissions",
			"food-warning-reports",
			"profile-images",
			"account-access",
			"catalog-review-work",
			"data-operations",
		]) {
			const route = readSource(
				`src/routes/profile/privileged-tools/${routeName}/+page.svelte`,
			);
			expect(route).toContain(`informationKey="${routeName}"`);
		}
	});

	it("keeps each review domain in a focused component", () => {
		const focusedWorkspaceView = readSource(
			"src/lib/components/moderation/PrivilegedToolWorkspaceView/PrivilegedToolWorkspaceView.svelte",
		);
		const focusedReviewListTypes = [
			"src/lib/components/moderation/ProductSubmissionReviewList/types.ts",
			"src/lib/components/moderation/FoodWarningReportReviewList/types.ts",
			"src/lib/components/moderation/ProfileImageReportReviewList/types.ts",
		].map(readSource);

		for (const [routeName, componentName] of [
			["product-submissions", "ProductSubmissionReviewList"],
			["food-warning-reports", "FoodWarningReportReviewList"],
			["profile-images", "ProfileImageReportReviewList"],
			["account-access", "AccountAccessReviewList"],
		] as const) {
			const focusedRoute = readSource(
				`src/routes/profile/privileged-tools/${routeName}/+page.svelte`,
			);
			expect(focusedRoute).toContain(componentName);
			expect(focusedRoute).toContain("PrivilegedToolWorkspaceView");
		}
		expect(focusedWorkspaceView).not.toContain("ModerationWorkspace");
		expect(focusedWorkspaceView).toContain("{@render children()}");
		for (const focusedReviewListType of focusedReviewListTypes) {
			expect(focusedReviewListType).not.toContain("ModerationWorkspace/types");
		}
	});
});
