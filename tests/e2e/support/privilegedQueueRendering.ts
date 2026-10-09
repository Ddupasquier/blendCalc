import type { Page, Route } from "@playwright/test";
import { stringify, unflatten } from "devalue";
import { expect } from "./browserTest";
import type { ProfilePrivilegedToolAccess } from "../../../src/lib/utils/moderation/profilePrivilegedTools";

/** Compare totals from one rendered server snapshot, not two changing requests. */
export const expectPrivilegedDashboardCountConsistency = async (
	page: Page,
	counts: number[],
) => {
	const overview = page.locator(
		".profile-privileged-tools-dashboard__overview",
	);
	const badge = overview.locator(".action-required-count-badge");
	const count = await badge.count();
	expect(count).toBeLessThanOrEqual(1);
	if (count === 0) {
		await expect(overview).toContainText("You're all caught up");
		expect(counts.reduce((sum, value) => sum + value, 0)).toBe(0);
		return;
	}
	const label = await badge.getAttribute("aria-label");
	const total = Number(label?.split(" ")[0]);
	expect(Number.isSafeInteger(total)).toBe(true);
	expect(total).toBeGreaterThan(0);
	expect(
		counts.every((value) => Number.isSafeInteger(value) && value > 0),
	).toBe(true);
	expect(counts.reduce((sum, value) => sum + value, 0)).toBe(total);
};

/** Render an empty tile only after the real local server authorizes its reviewer. */
export const withEmptyCatalogReviewRendering = async (
	page: Page,
	scenario: () => Promise<void>,
) => {
	const pattern = "**/profile/privileged-tools/__data.json*";
	let intercepted = false;
	const handler = async (route: Route) => {
		const url = new URL(route.request().url());
		expect(url.protocol).toBe("http:");
		expect(["localhost", "127.0.0.1"]).toContain(url.hostname);
		expect(url.port).toBe("5174");
		const response = await route.fetch({ maxRedirects: 0 });
		expect(response.status()).toBe(200);
		const payload = (await response.json()) as {
			type: string;
			nodes: Array<{ type: string; data?: unknown[] } | null>;
		};
		expect(payload.type).toBe("data");
		let summaries = 0;
		for (const node of payload.nodes) {
			if (node?.type !== "data" || !node.data) continue;
			const decoded = unflatten(node.data) as {
				access?: ProfilePrivilegedToolAccess;
			};
			if (!decoded.access) continue;
			expect(decoded.access.role).toBe("moderator");
			expect(decoded.access.permissions).toContain("moderation.catalog.review");
			const summary = decoded.access.reviewSummary;
			expect(summary.unavailable).toBe(false);
			expect(summary.identityVerificationRequired).toBe(false);
			expect(summary.pendingCatalogReviewItems).not.toBeNull();
			expect(summary.totalActionableItems).not.toBeNull();
			const catalogCount = summary.pendingCatalogReviewItems!;
			summary.pendingCatalogReviewItems = 0;
			summary.totalActionableItems =
				summary.totalActionableItems! - catalogCount;
			expect(summary.totalActionableItems).toBeGreaterThanOrEqual(0);
			node.data = JSON.parse(stringify(decoded));
			summaries += 1;
		}
		expect(summaries).toBe(1);
		intercepted = true;
		const headers = response.headers();
		delete headers["content-length"];
		delete headers["content-encoding"];
		await route.fulfill({ response, headers, json: payload });
	};
	await page.route(pattern, handler);
	try {
		await scenario();
		expect(intercepted).toBe(true);
	} finally {
		await page.unroute(pattern, handler);
	}
};
