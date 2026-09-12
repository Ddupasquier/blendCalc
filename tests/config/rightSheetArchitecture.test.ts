import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(path, "utf8");

describe("right-sheet architecture", () => {
	it("uses RightSheet as the only shared right-placement shell", () => {
		const rightSheet = readSource(
			"src/lib/components/common/sheets/RightSheet/RightSheet.svelte",
		);
		const ingredientRoutePopins = readSource(
			"src/lib/components/ingredients/page/IngredientRoutePopins/IngredientRoutePopins.svelte",
		);
		const profilePage = readSource("src/routes/profile/+page.svelte");
		const privilegedToolRightSheet = readSource(
			"src/lib/components/moderation/PrivilegedToolRightSheet/PrivilegedToolRightSheet.svelte",
		);
		const privilegedToolWorkspace = readSource(
			"src/lib/components/moderation/PrivilegedToolWorkspaceView/PrivilegedToolWorkspaceView.svelte",
		);
		const privilegedToolsDashboard = readSource(
			"src/lib/components/profile/ProfilePrivilegedToolsDashboard/ProfilePrivilegedToolsDashboard.svelte",
		);

		expect(rightSheet).toContain("<SheetBase");
		expect(rightSheet).toContain('placement="right"');
		expect(rightSheet).toContain("modal={false}");
		expect(rightSheet).toContain("backdrop={false}");
		expect(rightSheet).toContain("{panelClass}");
		expect(ingredientRoutePopins.match(/<RightSheet/g)).toHaveLength(2);
		expect(profilePage).toContain("<RightSheet");
		expect(privilegedToolRightSheet).toContain("<RightSheet");
		expect(privilegedToolRightSheet).toContain(
			'panelClass="privileged-tool-right-sheet-panel"',
		);
		expect(privilegedToolWorkspace).toContain("<PrivilegedProductLookup />");
		expect(privilegedToolWorkspace).toContain(
			'class="privileged-tool-workspace-view__guide"',
		);
		expect(privilegedToolsDashboard).toContain("<PrivilegedProductLookup />");
	});

	it("gives every privileged desktop route one full-width responsive canvas", () => {
		const variables = readSource("src/styles/_variables.scss");
		const focusedToolStyles = readSource(
			"src/lib/components/moderation/PrivilegedToolRightSheet/PrivilegedToolRightSheet.scss",
		);
		const landingPageStyles = readSource(
			"src/routes/profile/privileged-tools/page.scss",
		);
		const landingPage = readSource(
			"src/routes/profile/privileged-tools/+page.svelte",
		);
		const viewFrame = readSource(
			"src/lib/components/common/view/ViewFrame/ViewFrame.svelte",
		);
		const viewFrameStyles = readSource(
			"src/lib/components/common/view/ViewFrame/ViewFrame.scss",
		);

		expect(variables).toContain("$app-privileged-desktop-gutter: clamp(");
		expect(variables).toContain("15rem");
		expect(focusedToolStyles).toContain("max-width: none");
		expect(focusedToolStyles).toContain("$app-privileged-desktop-gutter");
		expect(landingPageStyles).toContain("$app-privileged-desktop-gutter");
		expect(landingPage).toContain("<ViewFrame appShell fullWidth");
		expect(viewFrame).toContain("class:view-frame--full-width={fullWidth}");
		expect(viewFrameStyles).toContain(
			".view-frame--app-shell.view-frame--full-width",
		);
		expect(focusedToolStyles).not.toContain("80rem");
	});

	it("stops privileged cards growing after their content reaches a useful width", () => {
		const variables = readSource("src/styles/_variables.scss");
		const collectionStyles = [
			"src/lib/components/moderation/ModeratorReviewList/ModeratorReviewList.scss",
			"src/lib/components/moderation/FoodWarningFollowUpList/FoodWarningFollowUpList.scss",
			"src/lib/components/moderation/CatalogReviewProductInbox/CatalogReviewProductInbox.scss",
			"src/lib/components/moderation/CatalogDataOperationsWorkList/CatalogDataOperationsWorkList.scss",
			"src/lib/components/moderation/AccountAccessReviewList/AccountAccessReviewList.scss",
			"src/lib/components/profile/ProfilePrivilegedToolsDashboard/ProfilePrivilegedToolsDashboard.scss",
			"src/lib/components/moderation/CatalogDataOperationsDashboard/CatalogDataOperationsDashboard.scss",
			"src/lib/components/moderation/CatalogProductRepairControls/CatalogProductRepairControls.scss",
			"src/lib/components/moderation/CatalogReviewWorkDashboard/CatalogReviewWorkDashboard.scss",
		].map(readSource);

		expect(variables).toContain("$app-privileged-card-grid-min-width: 32rem");
		expect(variables).toContain("$app-privileged-card-grid-max-width: 40rem");
		for (const styles of collectionStyles) {
			expect(styles).toContain("$app-privileged-card-grid-max-width");
			expect(styles).toContain("align-items: stretch");
		}

		const equalHeightCardStyles = [
			"src/lib/components/moderation/ModeratorReviewCard/ModeratorReviewCard.scss",
			"src/lib/components/moderation/FoodWarningFollowUpList/FoodWarningFollowUpList.scss",
			"src/lib/components/moderation/CatalogReviewProductInbox/CatalogReviewProductInbox.scss",
			"src/lib/components/moderation/CatalogDataOperationsWorkList/CatalogDataOperationsWorkList.scss",
			"src/lib/components/moderation/AccountAccessReviewList/AccountAccessReviewList.scss",
			"src/lib/components/profile/ProfilePrivilegedToolLink/ProfilePrivilegedToolLink.scss",
			"src/lib/components/moderation/CatalogDataOperationsDashboard/CatalogDataOperationsDashboard.scss",
			"src/lib/components/moderation/CatalogProductRepairControls/CatalogProductRepairControls.scss",
			"src/lib/components/moderation/CatalogReviewWorkDashboard/CatalogReviewWorkDashboard.scss",
		].map(readSource);

		for (const styles of equalHeightCardStyles) {
			expect(styles).toContain("height: 100%");
		}

		for (const focusedCardStyles of [
			"src/lib/components/moderation/NutrientMappingReview/NutrientMappingReview.scss",
			"src/lib/components/moderation/DatasetImportEvidenceReview/DatasetImportEvidenceReview.scss",
			"src/lib/components/moderation/FoodWarningFollowUpReview/FoodWarningFollowUpReview.scss",
			"src/lib/components/moderation/CatalogProductReviewDisposition/CatalogProductReviewDisposition.scss",
		].map(readSource)) {
			expect(focusedCardStyles).toContain(
				"width: min(100%, $app-privileged-card-grid-max-width)",
			);
		}
	});

	it("keeps privileged surfaces in the shared shadow-free visual system", () => {
		const privilegedStyles = [
			"src/lib/components/moderation/CatalogConflictDecisionWorkbench/CatalogConflictDecisionWorkbench.scss",
			"src/lib/components/moderation/PrivilegedProductLookup/PrivilegedProductLookup.scss",
		].map(readSource);

		for (const styles of privilegedStyles) {
			expect(styles).not.toContain("box-shadow");
		}
	});
});
