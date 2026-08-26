import { expect, test, waitForAppReady } from "./support/browserTest";

test(
	"email authentication switches modes without stale credential fields",
	{ tag: "@compatibility" },
	async ({ context, page }) => {
		await context.clearCookies();
		await page.goto("/auth");
		await waitForAppReady(page);

		const emailField = page.getByLabel("Email");
		const passwordField = page.getByLabel("Password", { exact: true });

		await emailField.fill("qa-user@blendcalc.local");
		await passwordField.fill("temporary credential");
		await page
			.getByRole("button", { name: "Create account", exact: true })
			.click();

		await expect(
			page.getByRole("heading", { name: "Create your account." }),
		).toBeVisible();
		await expect(emailField).toHaveValue("qa-user@blendcalc.local");
		await expect(passwordField).toHaveValue("");
		await expect(page.getByLabel("Confirm password")).toBeVisible();
		await expect(passwordField).toHaveAttribute("minlength", "15");

		await page.getByRole("button", { name: "Back to sign in" }).click();

		await expect(
			page.getByRole("heading", { name: "Welcome back." }),
		).toBeVisible();
		await expect(page.getByLabel("Confirm password")).toHaveCount(0);
		await expect(
			page.getByRole("button", { name: "Forgot your password?" }),
		).toBeVisible();
	},
);

test(
	"password recovery uses the shared labeled credential controls",
	{ tag: "@compatibility" },
	async ({ page }) => {
		await page.goto("/auth/update-password?reason=recovery");
		await waitForAppReady(page);

		const passwordField = page.getByLabel("New password");
		const confirmationField = page.getByLabel("Confirm password");

		await expect(passwordField).toHaveAttribute("autocomplete", "new-password");
		await expect(passwordField).toHaveAttribute("minlength", "15");
		await passwordField.fill("long temporary passphrase");
		await confirmationField.fill("long temporary passphrase");
		await expect(
			page.getByRole("button", { name: "Update password" }),
		).toBeEnabled();
	},
);
