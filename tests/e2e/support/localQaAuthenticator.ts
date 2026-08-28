import type { Page } from "@playwright/test";
import { createCurrentAuthenticatorVerificationCode } from "./authenticatorVerificationCode";

export const finishLocalQaAuthenticatorEnrollment = async (page: Page) => {
	await page.getByRole("button", { name: "Start setup" }).click();
	const setupKey = await page
		.locator(".mfa-enrollment__secret code")
		.innerText();
	await page
		.getByLabel("Six-digit code")
		.fill(createCurrentAuthenticatorVerificationCode(setupKey));
	await page.getByRole("button", { name: "Finish setup" }).click();
};
