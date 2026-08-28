import {
	expect,
	signInLocalQaAccount,
	test,
	waitForAppReady,
} from "./support/browserTest";
import { finishLocalQaAuthenticatorEnrollment } from "./support/localQaAuthenticator";
import {
	captureAndSetLocalQaCatalogSubmissionSuspension,
	deleteLocalQaAuthenticatorFactorsForEmail,
	restoreLocalQaCatalogSubmissionEnforcement,
} from "./support/localQaDatabase";
import type { Page } from "@playwright/test";

const suspendedAccountEmail = "qa-user@blendcalc.local";
const privilegedAccountEmail = "qa-developer@blendcalc.local";

const expectNoHorizontalOverflow = async (page: Page) => {
	const overflow = await page.evaluate(() => ({
		documentWidth: document.documentElement.scrollWidth,
		viewportWidth: document.documentElement.clientWidth,
	}));
	expect(overflow.documentWidth).toBeLessThanOrEqual(
		overflow.viewportWidth + 1,
	);
};

test("catalog rejection enforcement remains accurate, responsive, and user friendly", async ({
	page,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "desktop-chromium",
		"One isolated local Chromium project owns catalog-enforcement mutations.",
	);
	const baseUrl = new URL(
		String(testInfo.project.use.baseURL ?? "http://localhost:5174"),
	);
	test.skip(
		!["127.0.0.1", "localhost"].includes(baseUrl.hostname),
		"Catalog-enforcement mutations are restricted to disposable local infrastructure.",
	);

	const snapshot = await captureAndSetLocalQaCatalogSubmissionSuspension({
		email: suspendedAccountEmail,
	});
	await deleteLocalQaAuthenticatorFactorsForEmail(privilegedAccountEmail);

	try {
		await signInLocalQaAccount({
			page,
			email: privilegedAccountEmail,
			nextPath: "/profile",
		});
		await page.goto(
			`/profile/privileged-tools/account-access?q=${encodeURIComponent(suspendedAccountEmail)}`,
		);
		await expect(page).toHaveURL(/\/auth\/mfa\/enroll\?/);
		await finishLocalQaAuthenticatorEnrollment(page);
		await waitForAppReady(page);

		const accountAccessSheet = page.getByRole("dialog", {
			name: "Account access",
		});
		await expect(accountAccessSheet).toBeVisible();
		const suspendedAccountCard = accountAccessSheet
			.locator(".account-access__account")
			.filter({ hasText: suspendedAccountEmail });
		await expect(suspendedAccountCard).toHaveCount(1);
		await suspendedAccountCard.locator(":scope > details > summary").click();
		await expect(suspendedAccountCard).toContainText(
			"Rejected public submissions",
		);
		await expect(
			suspendedAccountCard.locator("dd").filter({ hasText: "51" }),
		).toHaveCount(1);
		await expect(suspendedAccountCard).toContainText(
			"Public product sharing is paused until",
		);

		for (const viewport of [
			{ width: 390, height: 844 },
			{ width: 320, height: 568 },
		]) {
			await page.setViewportSize(viewport);
			for (const theme of ["light", "dark"] as const) {
				await page.locator("html").evaluate((element, nextTheme) => {
					element.dataset.theme = nextTheme;
				}, theme);
				await expect(suspendedAccountCard).toBeVisible();
				await expectNoHorizontalOverflow(page);
			}
		}

		const accountSearch = accountAccessSheet.getByRole("searchbox", {
			name: "Search accounts",
		});
		await accountSearch.fill("qa-empty@blendcalc.local");
		await accountAccessSheet.getByRole("button", { name: "Search" }).click();
		await expect(page).toHaveURL(/q=qa-empty%40blendcalc\.local/);
		const zeroCountAccountCard = accountAccessSheet
			.locator(".account-access__account")
			.filter({ hasText: "qa-empty@blendcalc.local" });
		await zeroCountAccountCard.locator(":scope > details > summary").click();
		await expect(
			zeroCountAccountCard.locator("dd").filter({ hasText: "0" }),
		).toHaveCount(1);
		await expect(zeroCountAccountCard).not.toContainText(
			"Public product sharing is paused until",
		);

		await signInLocalQaAccount({
			page,
			email: suspendedAccountEmail,
			nextPath: "/ingredients/fridge",
		});
		const blockedSubmissionResponse = await page.request.post(
			"/api/products/submissions",
			{
				headers: { origin: baseUrl.origin },
				multipart: {
					consentToShare: "true",
					food: JSON.stringify({
						barcode: "00012345678905",
						description: "Catalog Suspension Boundary Test",
						fdcId: -9_820_001,
						foodNutrients: [],
					}),
				},
			},
		);
		expect(blockedSubmissionResponse.status()).toBe(429);
		expect(await blockedSubmissionResponse.json()).toMatchObject({
			code: "CATALOG_SUBMISSION_BLOCKED",
		});
	} finally {
		await restoreLocalQaCatalogSubmissionEnforcement(snapshot);
		await deleteLocalQaAuthenticatorFactorsForEmail(privilegedAccountEmail);
	}
});
