import { expect, test, waitForAppReady } from "./support/browserTest";

test(
	"email authentication switches modes without stale credential fields",
	{ tag: "@compatibility" },
	async ({ context, page }) => {
		await context.clearCookies();
		await page.goto("/auth");
		await waitForAppReady(page);
		await page
			.getByRole("switch", { name: "Test the real sign-in flow" })
			.click();

		const emailField = page.getByLabel("Email");
		const passwordField = page.getByLabel("Password", { exact: true });

		await emailField.fill("qa-user@blendcalc.local");
		await passwordField.fill("temporary credential");
		await expect(passwordField).toHaveAttribute("type", "password");
		await page.getByRole("button", { name: "Show password" }).click();
		await expect(passwordField).toHaveAttribute("type", "text");
		await expect(passwordField).toHaveValue("temporary credential");
		await page.getByRole("button", { name: "Hide password" }).click();
		await expect(passwordField).toHaveAttribute("type", "password");
		await page
			.getByRole("button", { name: "Create account", exact: true })
			.click();

		await expect(
			page.getByRole("heading", { name: "Create your account." }),
		).toBeVisible();
		await expect(emailField).toHaveValue("qa-user@blendcalc.local");
		await expect(passwordField).toHaveValue("");
		await expect(
			page.getByLabel("Confirm password", { exact: true }),
		).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Show confirm password" }),
		).toBeVisible();
		await expect(passwordField).toHaveAttribute("minlength", "15");
		const confirmationField = page.getByLabel("Confirm password", {
			exact: true,
		});
		const createAccountButton = page.getByRole("button", {
			name: "Create account",
			exact: true,
		});
		await passwordField.fill("a sufficiently long passphrase");
		await confirmationField.fill("a different long passphrase");
		await expect(confirmationField).toHaveAttribute("aria-invalid", "true");
		await expect(page.getByText("Passwords do not match")).toBeVisible();
		await expect(createAccountButton).toBeDisabled();
		await confirmationField.fill("a sufficiently long passphrase");
		await expect(confirmationField).toHaveAttribute("aria-invalid", "false");
		await expect(page.getByText("Passwords match")).toBeVisible();
		await expect(createAccountButton).toBeEnabled();
		await passwordField.fill("a newly changed long passphrase");
		await expect(confirmationField).toHaveAttribute("aria-invalid", "true");
		await expect(page.getByText("Passwords do not match")).toBeVisible();
		await expect(createAccountButton).toBeDisabled();
		await passwordField.fill("a sufficiently long passphrase");
		await expect(createAccountButton).toBeEnabled();

		await page.getByRole("button", { name: "Back to sign in" }).click();

		await expect(
			page.getByRole("heading", { name: "Welcome back." }),
		).toBeVisible();
		const googleButton = page.getByRole("button", {
			name: "Continue with Google",
		});
		await expect(
			googleButton.locator("[data-google-brand-icon] svg"),
		).toHaveCount(1);
		await expect(page.getByLabel("Confirm password")).toHaveCount(0);
		await expect(
			page.getByRole("button", { name: "Forgot your password?" }),
		).toBeVisible();
		const passwordBounds = await passwordField.boundingBox();
		const recoveryLink = page.getByRole("button", {
			name: "Forgot your password?",
		});
		const recoveryBounds = await recoveryLink.boundingBox();
		expect(passwordBounds).not.toBeNull();
		expect(recoveryBounds).not.toBeNull();
		expect(recoveryBounds!.y).toBeGreaterThanOrEqual(
			passwordBounds!.y + passwordBounds!.height,
		);
		expect(recoveryBounds!.x).toBeLessThan(passwordBounds!.x + 16);
		expect(recoveryBounds!.height).toBeGreaterThanOrEqual(44);
	},
);

test("local QA sign-in chooses a seeded account without requesting a password", async ({
	context,
	page,
}) => {
	await context.clearCookies();
	await page.goto("/auth?next=%2Fingredients%2Ffridge");
	await waitForAppReady(page);

	await expect(
		page.getByRole("heading", { name: "Choose a QA account." }),
	).toBeVisible();
	await expect(
		page.getByRole("switch", { name: "Test the real sign-in flow" }),
	).not.toBeChecked();
	await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);

	const accountPicker = page.getByRole("combobox", { name: "QA account" });
	await accountPicker.click();
	await expect(page.getByRole("option")).toHaveCount(10);
	await page
		.getByRole("option", { name: /QA Empty State · qa-empty@blendcalc\.local/ })
		.click();
	await expect(
		page.getByText(
			/Authenticated empty states without onboarding interruption/,
		),
	).toBeVisible();

	await page
		.getByRole("button", { name: "Continue as QA Empty State" })
		.click();
	await expect(page).toHaveURL(/\/ingredients\/fridge$/);
});

test(
	"local QA sign-in keeps the real credential flow usable on a compact screen",
	{ tag: "@mobile" },
	async ({ context, page }) => {
		await context.clearCookies();
		await page.setViewportSize({ width: 360, height: 740 });
		await page.goto("/auth");
		await waitForAppReady(page);

		const realFlowSwitch = page.getByRole("switch", {
			name: "Test the real sign-in flow",
		});
		await realFlowSwitch.focus();
		await realFlowSwitch.press("Space");
		await expect(realFlowSwitch).toBeChecked();
		await expect(page.getByLabel("Email")).toBeVisible();
		await expect(page.getByLabel("Password", { exact: true })).toBeVisible();

		await page.getByLabel("Email").fill("qa-user@blendcalc.local");
		await page.getByLabel("Password", { exact: true }).fill("not-the-password");
		await page.getByRole("button", { name: "Sign in", exact: true }).click();
		await expect(
			page.getByText("Email or password was not accepted."),
		).toBeVisible();
		await expect(realFlowSwitch).toBeChecked();
		await expect
			.poll(() =>
				page.evaluate(
					() => document.documentElement.scrollWidth <= window.innerWidth,
				),
			)
			.toBe(true);
	},
);

test(
	"password recovery uses the shared labeled credential controls",
	{ tag: "@compatibility" },
	async ({ page }) => {
		await page.goto("/auth/update-password?reason=recovery");
		await waitForAppReady(page);

		const passwordField = page.getByLabel("New password", { exact: true });
		const confirmationField = page.getByLabel("Confirm password", {
			exact: true,
		});

		await expect(passwordField).toHaveAttribute("autocomplete", "new-password");
		await expect(passwordField).toHaveAttribute("minlength", "15");
		await expect(passwordField).toHaveAttribute(
			"placeholder",
			"Use a long passphrase",
		);
		await expect(confirmationField).toHaveAttribute(
			"placeholder",
			"Enter it again",
		);
		await passwordField.fill("long temporary passphrase");
		await confirmationField.fill("different temporary phrase");
		await expect(confirmationField).toHaveAttribute("aria-invalid", "true");
		await expect(page.getByText("Passwords do not match")).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Update password" }),
		).toBeDisabled();
		await confirmationField.fill("long temporary passphrase");
		await expect(confirmationField).toHaveAttribute("aria-invalid", "false");
		await expect(page.getByText("Passwords match")).toBeVisible();
		await passwordField.fill("newly changed temporary passphrase");
		await expect(confirmationField).toHaveAttribute("aria-invalid", "true");
		await expect(
			page.getByRole("button", { name: "Update password" }),
		).toBeDisabled();
		await passwordField.fill("long temporary passphrase");
		await page.getByRole("button", { name: "Show new password" }).click();
		await expect(passwordField).toHaveAttribute("type", "text");
		await expect(passwordField).toHaveValue("long temporary passphrase");
		await page.getByRole("button", { name: "Hide new password" }).click();
		await expect(passwordField).toHaveAttribute("type", "password");
		await page.getByRole("button", { name: "Show confirm password" }).click();
		await expect(confirmationField).toHaveAttribute("type", "text");
		await expect(confirmationField).toHaveValue("long temporary passphrase");
		await expect(
			page.getByRole("button", { name: "Update password" }),
		).toBeEnabled();
	},
);
