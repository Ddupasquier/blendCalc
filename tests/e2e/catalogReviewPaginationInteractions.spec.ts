import {
	expect,
	test,
	signInLocalQaAccount,
	waitForAppReady,
} from "./support/browserTest";
import { finishLocalQaAuthenticatorEnrollment } from "./support/localQaAuthenticator";
import { createLocalQaCatalogReviewer } from "./support/localQaCatalogReviewer";
import { randomInt } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import type { Page, TestInfo } from "@playwright/test";

// This corpus owns global catalog queues and one disposable MFA persona. Run serially.
test.describe.configure({ mode: "serial" });
const root = "/profile/privileged-tools/catalog-review-work";
const fixtureSql =
	"begin;\n" +
	readFileSync(
		"supabase/tests/database/catalog_review_cursor_pages.test.sql",
		"utf8",
	)
		.split(
			"-- Trusted synthetic fixture construction, not an application write bypass.",
		)[1]
		.split("select ok(not has_function_privilege")[0] +
	"\ncommit;";
const localSql = (sql: string) =>
	execFileSync(
		"docker",
		[
			"exec",
			"-i",
			"supabase_db_blendcalc",
			"psql",
			"-U",
			"postgres",
			"-d",
			"postgres",
			"-v",
			"ON_ERROR_STOP=1",
			"--tuples-only",
			"--no-align",
		],
		{ input: sql, stdio: ["pipe", "pipe", "pipe"] },
	);

test("independent catalog reviewers keep ordinary Auth and MFA sessions isolated @compatibility @mobile", async ({
	page,
}) => {
	const firstReviewer = await createLocalQaCatalogReviewer();
	try {
		await signInLocalQaAccount({
			page,
			email: firstReviewer.email,
			nextPath: "/profile",
		});
		await page.goto(root);
		await expect(page).toHaveURL(/\/auth\/mfa\/enroll\?/u);
		await finishLocalQaAuthenticatorEnrollment(page);
		await waitForAppReady(page);
		await expect(page).toHaveURL((url) => url.pathname === root);
		const secondReviewer = await createLocalQaCatalogReviewer();
		await secondReviewer.cleanup();
		await page.reload();
		await waitForAppReady(page);
		await expect(page).toHaveURL((url) => url.pathname === root);
		const response = await page.request.get(
			"/api/moderation/catalog-review-pages?queue=products",
		);
		expect(response.status()).toBe(200);
	} finally {
		await firstReviewer.cleanup();
	}
});

const withCatalogReviewFixture = async (
	page: Page,
	testInfo: TestInfo,
	scenario: (fixture: { scope: string; productId: string }) => Promise<void>,
) => {
	const base = new URL(
		String(testInfo.project.use.baseURL ?? "http://localhost:5174"),
	);
	expect(["localhost", "127.0.0.1"]).toContain(base.hostname);
	expect(base.port).toBe("5174");
	const projectIndex = [
		"desktop-chromium",
		"desktop-firefox",
		"desktop-webkit",
		"mobile-chromium",
		"mobile-webkit",
	].indexOf(testInfo.project.name);
	expect(projectIndex).toBeGreaterThanOrEqual(0);
	// Every attempt owns a new namespace, preserving prior manual QA and retries.
	let scope = "";
	for (let attempt = 0; attempt < 5; attempt += 1) {
		const candidate = String(randomInt(40000, 80000));
		const existing = Number(
			localSql(
				`select count(*) from public.shared_products where id::text like '${candidate}000-%';`,
			)
				.toString()
				.trim(),
		);
		if (existing === 0) {
			scope = candidate;
			break;
		}
	}
	expect(scope).not.toBe("");
	const productId = `${scope}000-0000-4000-8000-000000000001`;
	const scopedSql = fixtureSql
		.replaceAll("99978", scope)
		.replaceAll("QA-pagination-", `QA-pagination-${scope}-`)
		.replaceAll("9790000000000", String(9790000000000 + Number(scope) * 1000))
		.replaceAll(
			"09790000000001",
			String(9790000000001 + Number(scope) * 1000).padStart(14, "0"),
		);
	// A rollback-safe database corpus owns terminal effects; this fixture is disposable
	// TEST-only. Never reset saved QA data or write directly to Auth tables.
	const reviewer = await createLocalQaCatalogReviewer();
	let seeded = false;
	try {
		localSql(scopedSql);
		seeded = true;
		await signInLocalQaAccount({
			page,
			email: reviewer.email,
			nextPath: "/profile",
		});
		await page.goto(root);
		await expect(page).toHaveURL(/\/auth\/mfa\/enroll\?/u);
		await finishLocalQaAuthenticatorEnrollment(page);
		await waitForAppReady(page);
		await scenario({ scope, productId });
	} finally {
		// Only purpose-created fixture rows: reviewed state is removed by the
		// final disposable reset, not by bypassing immutable-history safeguards here.
		try {
			if (seeded)
				localSql(
					`update public.shared_product_conflicts set status='resolved', resolved_at=now(), resolution_note='QA fixture retired' where id::text like '${scope}100-%' or id::text like '${scope}200-%'; update public.catalog_provider_change_reviews set status='superseded', reviewed_at=now(), review_note='QA fixture retired' where id::text like '${scope}500-%' or id::text like '${scope}b00-%'; update public.official_food_safety_alert_matches set status='superseded' where id::text like '${scope}700-%';`,
				);
		} finally {
			await reviewer.cleanup();
		}
	}
};

test("catalog inbox appends, retries and preserves focus during routed navigation @compatibility @mobile", async ({
	page,
	unexpectedBrowserErrors,
}, testInfo) => {
	await withCatalogReviewFixture(page, testInfo, async ({ productId }) => {
		const inbox = page.locator(".catalog-review-inbox");
		const links = inbox.locator(".catalog-review-inbox__product");
		await expect(links).toHaveCount(20);
		let failOnce = true;
		await page.route(
			"**/api/moderation/catalog-review-pages?**",
			async (route) => {
				if (
					failOnce &&
					new URL(route.request().url()).searchParams.get("queue") ===
						"products"
				) {
					failOnce = false;
					await route.abort("failed");
				} else await route.continue();
			},
		);
		await inbox.getByRole("button", { name: "Load more products" }).click();
		await expect(
			inbox.getByRole("button", { name: "Retry products" }),
		).toBeVisible();
		await expect(links).toHaveCount(20);
		await inbox.getByRole("button", { name: "Retry products" }).click();
		await expect(links).toHaveCount(40);
		// The deliberately aborted request may emit Chromium's exact network error.
		// Keep every other browser error fatal; never suppress application failures.
		for (const error of unexpectedBrowserErrors.splice(0)) {
			expect(error).toBe(
				"console.error: Failed to load resource: net::ERR_FAILED",
			);
		}
		// The failure injection is complete. Restore ordinary browser networking
		// before testing link preloads and navigation.
		await page.unroute("**/api/moderation/catalog-review-pages?**");
		const loadProducts = inbox.getByRole("button", {
			name: "Load more products",
		});
		await loadProducts.scrollIntoViewIfNeeded();
		await loadProducts.focus();
		const inboxScroll = page
			.locator(".privileged-tool-right-sheet__body")
			.first();
		const position = await inboxScroll.evaluate((element) =>
			Math.round(element.scrollTop),
		);
		expect(position).toBeGreaterThan(0);
		await loadProducts.press("Enter");
		await expect(links).toHaveCount(60);
		await expect(loadProducts).toBeFocused();
		await expect
			.poll(() =>
				inboxScroll.evaluate((element) => Math.round(element.scrollTop)),
			)
			.toBe(position);
		const hrefs = await links.evaluateAll((elements) =>
			elements.map((element) => element.getAttribute("href")),
		);
		expect(new Set(hrefs).size).toBe(60);
		await expect(
			inbox.getByRole("button", { name: "Return to top" }),
		).toBeVisible();
		await inbox.getByRole("button", { name: "Return to top" }).click();
		await expect
			.poll(() =>
				inboxScroll.evaluate((element) => Math.round(element.scrollTop)),
			)
			.toBe(0);
		const documentEpoch = await page.evaluate(() => performance.timeOrigin);
		await inbox.locator(`a[href="${root}/products/${productId}"]`).click();
		await waitForAppReady(page);
		const product = page.getByRole("dialog", { name: "Product readiness" });
		await expect(product).toBeVisible();
		expect(await page.evaluate(() => performance.timeOrigin)).toBe(
			documentEpoch,
		);
	});
});

test("exact-product catalog queues preserve drafts, responsive controls and atomic completion @compatibility @mobile", async ({
	page,
}, testInfo) => {
	await withCatalogReviewFixture(
		page,
		testInfo,
		async ({ scope, productId }) => {
			await page.goto(`${root}/products/${productId}`);
			await waitForAppReady(page);
			const product = page.getByRole("dialog", { name: "Product readiness" });
			await expect(product).toBeVisible();
			const recallFooter = product.getByLabel("Recall matches pagination", {
				exact: true,
			});
			await expect(recallFooter).toContainText(
				"20 of 61 recall matches loaded",
			);
			await product
				.getByRole("button", { name: "Load more recall matches" })
				.click();
			await expect(recallFooter).toContainText(
				"40 of 61 recall matches loaded",
			);
			await product
				.getByRole("button", { name: "Load more recall matches" })
				.click();
			await expect(recallFooter).toContainText(
				"60 of 61 recall matches loaded",
			);
			const conflictFooter = product.getByLabel("Conflicts pagination", {
				exact: true,
			});
			await expect(conflictFooter).toContainText("20 of 61 conflicts loaded");
			await expect(
				product.getByRole("button", { name: "Finish product review" }),
			).toBeDisabled();
			await product
				.getByRole("button", { name: "Load more conflicts" })
				.click();
			await expect(conflictFooter).toContainText("40 of 61 conflicts loaded");
			await product
				.getByRole("button", { name: "Load more conflicts" })
				.click();
			await expect(conflictFooter).toContainText("60 of 61 conflicts loaded");
			await product
				.getByRole("button", { name: "Load more conflicts" })
				.click();
			await expect(conflictFooter).toContainText("61 of 61 conflicts loaded");
			await expect(
				product.getByRole("button", { name: "Load more conflicts" }),
			).toHaveCount(0);
			const recalls = product.locator("form:has(input[name=matchId])");
			expect(await recalls.count()).toBe(60);
			const firstConflict = product
				.locator(".catalog-conflict-workbench__finding")
				.filter({ has: page.getByText("Decision 1 of 61", { exact: true }) });
			await firstConflict.getByRole("combobox").click();
			await page
				.getByRole("option", {
					name: "Cannot determine from current evidence",
					exact: true,
				})
				.click();
			const decisionNote =
				"QA control: the exact ingredient evidence is insufficient for a correction.";
			await firstConflict.getByRole("textbox").fill(decisionNote);
			const first = product.locator(
				`form:has(input[value="${scope}700-0000-4000-8000-000000000001"])`,
			);
			await first.getByRole("combobox").click();
			await page
				.getByRole("option", { name: "No — this is a different product" })
				.click();
			await first
				.getByRole("textbox")
				.fill("QA control: the exact package code does not match this notice.");
			await first.getByRole("button", { name: "Dismiss recall match" }).click();
			await expect(first).toHaveCount(0);
			await expect(recallFooter).toContainText(
				"60 of 60 recall matches loaded",
			);
			await expect(firstConflict.getByRole("textbox")).toHaveValue(
				decisionNote,
			);
			const providerFooter = product.getByLabel("Provider changes pagination", {
				exact: true,
			});
			await product
				.locator("summary")
				.filter({ hasText: "Provider changes" })
				.click();
			await expect(providerFooter).toBeVisible();
			await expect(providerFooter).toContainText(
				"20 of 61 provider changes loaded",
			);
			for (const count of [40, 60, 61]) {
				await product
					.getByRole("button", { name: "Load more provider changes" })
					.click();
				await expect(providerFooter).toContainText(
					`${count} of 61 provider changes loaded`,
				);
			}
			await expect(
				product.getByRole("button", { name: "Load more provider changes" }),
			).toHaveCount(0);
			for (const width of [1024, 390]) {
				await page.setViewportSize({ width, height: 844 });
				const decisionHeading = product
					.locator(
						'form:has(input[name="reviewId"]) header.catalog-review-work__decision-heading',
					)
					.first();
				const headingRows = await decisionHeading.evaluate((element) => ({
					titleBottom: element.querySelector("strong")!.getBoundingClientRect()
						.bottom,
					copyTop: element.querySelector("span")!.getBoundingClientRect().top,
				}));
				expect(headingRows.copyTop).toBeGreaterThanOrEqual(
					headingRows.titleBottom,
				);
				await decisionHeading.screenshot({
					path: testInfo.outputPath(`provider-decision-heading-${width}.png`),
				});
				const overflow = await page.evaluate(
					() =>
						document.documentElement.scrollWidth >
						document.documentElement.clientWidth + 1,
				);
				expect(overflow).toBe(false);
				await product.screenshot({
					path: testInfo.outputPath(`catalog-queues-${width}.png`),
				});
				for (const colorScheme of ["light", "dark"] as const) {
					await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
					await recallFooter.screenshot({
						path: testInfo.outputPath(
							`recall-footer-${width}-${colorScheme}.png`,
						),
					});
				}
			}
			await page.evaluate(() => {
				document.documentElement.style.fontSize = "200%";
			});
			await conflictFooter.screenshot({
				path: testInfo.outputPath("conflict-footer-390-text200.png"),
			});
			const footerBounds = await conflictFooter.boundingBox();
			expect(footerBounds).not.toBeNull();
			expect(footerBounds!.x + footerBounds!.width).toBeLessThanOrEqual(391);
			await page.evaluate(() => {
				document.documentElement.style.fontSize = "";
			});
			await page.goto(
				`${root}/products/${scope}000-0000-4000-8000-000000000061`,
			);
			await waitForAppReady(page);
			await expect(
				page.getByLabel("Provider changes pagination", { exact: true }),
			).toContainText("1 of 1 provider changes loaded");
			const workbench = page.locator(".catalog-conflict-workbench");
			await workbench.getByRole("combobox").click();
			await page
				.getByRole("option", {
					name: "Cannot determine from current evidence",
					exact: true,
				})
				.click();
			await workbench
				.getByRole("textbox")
				.fill(
					"QA control: no exact label supports changing this ingredient field.",
				);
			await workbench
				.getByRole("button", { name: "Finish product review", exact: true })
				.click();
			await expect(page).not.toHaveURL(
				new RegExp(`${scope}000-0000-4000-8000-000000000061$`, "u"),
			);
			await page.goto(
				`${root}/products/${scope}000-0000-4000-8000-000000000061`,
			);
			await waitForAppReady(page);
			await expect(page.locator(".catalog-conflict-workbench")).toHaveCount(0);
			const provider = page.locator('form:has(input[name="reviewId"])');
			await expect(
				provider.getByRole("button", {
					name: "Keep current record",
					exact: true,
				}),
			).toBeDisabled();
			await provider
				.getByRole("textbox")
				.fill(
					"QA control: this observation lacks the exact package evidence needed for a correction.",
				);
			await provider
				.getByRole("button", { name: "Keep current record", exact: true })
				.click();
			await expect(provider).toHaveCount(0);
		},
	);
});
