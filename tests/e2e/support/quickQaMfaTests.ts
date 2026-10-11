import {
	expect,
	test,
	waitForAppReady,
	signInLocalQaAccount,
} from "./browserTest";
import type { Page } from "@playwright/test";
import { unflatten } from "devalue";

const toolsPath = "/profile/privileged-tools";
const landingPath = "/ingredients/fridge";
const queuePath = "/api/moderation/food-warning-queues?queue=reports";

// Read the same verified root-layout identity/assignment that the app shell uses.
// This is real authenticated server data, not a JWT decode or a rendering mock.
const readVerifiedLayoutIdentity = async (page: Page) => {
	const response = await page.request.get(`${landingPath}/__data.json`);
	expect(response.status()).toBe(200);
	const payload = (await response.json()) as {
		type: string;
		nodes: Array<{ type: string; data?: unknown[] } | null>;
	};
	expect(payload.type).toBe("data");
	for (const node of payload.nodes) {
		if (node?.type !== "data" || !node.data) continue;
		const decoded = unflatten(node.data) as {
			authUser?: { id: string; displayName: string; role: string | null };
		};
		if (decoded.authUser) {
			const { id, displayName, role } = decoded.authUser;
			return { id, displayName, role };
		}
	}
	throw new Error("Verified root-layout identity is missing.");
};

// Register each maintained persona alongside the tests that reset its MFA factors.
// The owning spec's default mode prevents a second worker invalidating its session.
export const registerQuickQaMfaTests = (
	personas: Array<"Moderator" | "Admin" | "Developer">,
) => {
	for (const persona of personas) {
		test(
			`Quick QA verifies ${persona} without manual MFA`,
			{ tag: "@compatibility" },
			async ({ context, page }) => {
				// Keep the fixture's TEST-only quota partition while removing its session.
				await context.clearCookies({ name: /auth-token/ });
				// Auth can legitimately wait 31s for replay-safe TOTP. Keep its
				// role/session proof independent of the tools diagnostics workload.
				await page.goto(`/auth?next=${encodeURIComponent(landingPath)}`);
				await waitForAppReady(page);
				await page.getByRole("combobox", { name: "QA account" }).click();
				await page
					.getByRole("option", { name: new RegExp(`QA ${persona} ·`) })
					.click();
				await page
					.getByRole("button", { name: `Continue as QA ${persona}` })
					.click();
				await expect(page).toHaveURL((url) => url.pathname === landingPath, {
					timeout: 45_000,
				});
				const identity = await readVerifiedLayoutIdentity(page);
				expect(identity.displayName).toBe(`QA ${persona}`);
				expect(identity.role).toBe(persona.toLowerCase());
				const identityLink = page.getByRole("link", {
					name: `Open profile for QA ${persona}`,
					exact: true,
				});
				await expect(identityLink).toBeVisible();
				await expect(page.getByLabel("Six-digit code")).toHaveCount(0);
				const response = await page.request.get(queuePath);
				expect(response.status()).toBe(200);
				await page.reload();
				await expect(page).toHaveURL((url) => url.pathname === landingPath);
				await expect(identityLink).toBeVisible();
				expect(await readVerifiedLayoutIdentity(page)).toEqual(identity);
				await expect(page.getByLabel("Six-digit code")).toHaveCount(0);
				const reloadedAccess = await page.request.get(queuePath);
				expect(reloadedAccess.status()).toBe(200);
			},
		);
	}
};

export const registerOrdinaryQuickQaTest = () => {
	test(
		"ordinary Quick QA accounts remain forbidden",
		{ tag: "@compatibility" },
		async ({ context, page }) => {
			await context.clearCookies({ name: /auth-token/ });
			await page.goto("/auth");
			await waitForAppReady(page);
			await page.getByRole("button", { name: "Continue as QA User" }).click();
			await expect(page).toHaveURL(/\/ingredients\/fridge$/);
			const response = await page.request.get(queuePath);
			expect(response.status()).toBe(403);
		},
	);
};

export const registerManualQaMfaTest = () => {
	test(
		"real credential login retains the manual MFA challenge",
		{ tag: "@compatibility" },
		async ({ page }) => {
			await signInLocalQaAccount({
				page,
				email: "qa-developer@blendcalc.local",
				nextPath: "/profile",
			});
			await page.goto(toolsPath);
			await expect(page).toHaveURL(/\/auth\/mfa\/challenge\?/);
			await expect(page.getByLabel("Six-digit code")).toBeVisible();
		},
	);
};
