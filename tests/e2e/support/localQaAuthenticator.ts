import type { Page } from "@playwright/test";
import { createCurrentAuthenticatorVerificationCode } from "./authenticatorVerificationCode";

export const finishLocalQaAuthenticatorEnrollment = async (
	page: Page,
	submitWithKeyboard = false,
) => {
	await page.getByRole("button", { name: "Start setup" }).click();
	const setupKey = await page
		.locator(".mfa-enrollment__secret code")
		.innerText();
	await page
		.getByLabel("Six-digit code")
		.fill(createCurrentAuthenticatorVerificationCode(setupKey));
	const finish = page.getByRole("button", { name: "Finish setup" });
	if (submitWithKeyboard) {
		await page.mouse.move(0, 0);
		await finish.focus();
		await finish.press("Enter");
	} else {
		await finish.click();
	}
};
