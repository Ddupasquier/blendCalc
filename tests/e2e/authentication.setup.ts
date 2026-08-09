import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { expect, test as setup } from "@playwright/test";
import {
	authenticatedBrowserStatePath,
	localQaAccount,
} from "./support/localQaAccount";

const waitForAppReady = async (page: import("@playwright/test").Page) => {
	await expect(page.locator("html")).toHaveAttribute("data-app-ready", "true");
};

setup("authenticate the disposable QA user", async ({ page }) => {
	await page.goto("/auth?next=/ingredients/fridge");
	await page.getByLabel("Email").fill(localQaAccount.email);
	await page.getByLabel("Password", { exact: true }).fill(localQaAccount.password);
	await page.getByRole("button", { name: "Sign in", exact: true }).click();

	await expect(page).toHaveURL(/\/ingredients\/fridge(?:[/?#]|$)/);
	await expect(
		page.getByRole("heading", { name: "Ingredients", exact: true }),
	).toBeVisible();
	await waitForAppReady(page);

	await mkdir(dirname(authenticatedBrowserStatePath), { recursive: true });
	await page.context().storageState({ path: authenticatedBrowserStatePath });
});
