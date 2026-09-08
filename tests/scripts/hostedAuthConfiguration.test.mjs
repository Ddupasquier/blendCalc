import { describe, expect, it } from "vitest";
import {
	assertHostedAuthProjectConfirmation,
	buildHostedAuthPatch,
	isValidTurnstileSecretProbe,
	summarizeHostedAuthConfiguration,
} from "../../scripts/operations/auth/configure_hosted_auth.mjs";

describe("hosted Auth configuration", () => {
	it("builds the explicitly requested Turnstile update", () => {
		expect(
			buildHostedAuthPatch(
				{ SUPABASE_AUTH_TURNSTILE_SECRET: "protected-turnstile-secret" },
				{ turnstile: true },
			),
		).toEqual({
			security_captcha_enabled: true,
			security_captcha_provider: "turnstile",
			security_captcha_secret: "protected-turnstile-secret",
		});
	});

	it("requires every custom SMTP input before building an update", () => {
		expect(() =>
			buildHostedAuthPatch(
				{
					SUPABASE_AUTH_SMTP_ADMIN_EMAIL: "auth@example.test",
					SUPABASE_AUTH_SMTP_HOST: "smtp.example.test",
				},
				{ smtp: true },
			),
		).toThrow("SUPABASE_AUTH_SMTP_PORT");
	});

	it("reports only safe hosted configuration status", () => {
		const expectedPatch = {
			security_captcha_secret: "never-report-this",
			smtp_admin_email: "auth@example.test",
			smtp_host: "smtp.example.test",
			smtp_port: "587",
			smtp_user: "blendcalc",
			smtp_pass: "never-report-this-either",
			smtp_sender_name: "blendCalc",
		};
		const summary = summarizeHostedAuthConfiguration(
			{
				security_captcha_enabled: true,
				security_captcha_provider: "turnstile",
				security_captcha_secret: "provider-returned-secret-hmac",
				...Object.fromEntries(
					Object.entries(expectedPatch).filter(
						([field]) =>
							field !== "security_captcha_secret" && field !== "smtp_pass",
					),
				),
				smtp_pass: "provider-returned-protected-value",
			},
			{ turnstile: true, smtp: true },
			expectedPatch,
		);

		expect(summary).toEqual({
			turnstileConfigured: true,
			customSmtpConfigured: true,
		});
		expect(JSON.stringify(summary)).not.toContain("never-report-this");
	});

	it.each([
		"smtp_admin_email",
		"smtp_host",
		"smtp_port",
		"smtp_user",
		"smtp_sender_name",
	])("rejects an SMTP %s mismatch", (field) => {
		const expectedPatch = {
			smtp_admin_email: "auth@example.test",
			smtp_host: "smtp.example.test",
			smtp_port: "587",
			smtp_user: "blendcalc",
			smtp_pass: "protected-request-value",
			smtp_sender_name: "blendCalc",
		};
		const authConfiguration = {
			...expectedPatch,
			smtp_pass: "provider-returned-protected-value",
			[field]: "unexpected-value",
		};

		expect(
			summarizeHostedAuthConfiguration(
				authConfiguration,
				{ smtp: true },
				expectedPatch,
			),
		).toEqual({ customSmtpConfigured: false });
	});

	it("requires a non-empty stored SMTP credential marker", () => {
		const expectedPatch = {
			smtp_admin_email: "auth@example.test",
			smtp_host: "smtp.example.test",
			smtp_port: "587",
			smtp_user: "blendcalc",
			smtp_pass: "protected-request-value",
			smtp_sender_name: "blendCalc",
		};

		expect(
			summarizeHostedAuthConfiguration(
				{ ...expectedPatch, smtp_pass: "" },
				{ smtp: true },
				expectedPatch,
			),
		).toEqual({ customSmtpConfigured: false });
	});

	it("recognizes Cloudflare's safe valid-secret probe response", () => {
		expect(
			isValidTurnstileSecretProbe({
				success: false,
				"error-codes": ["missing-input-response"],
			}),
		).toBe(true);
		expect(
			isValidTurnstileSecretProbe({
				success: false,
				"error-codes": ["invalid-input-secret"],
			}),
		).toBe(false);
	});

	it("requires the dry-run project reference before a hosted write", () => {
		expect(() =>
			assertHostedAuthProjectConfirmation({
				projectReference: "abcdefghijklmnopqrst",
				confirmation: undefined,
			}),
		).toThrow("--confirm-project=abcdefghijklmnopqrst");
		expect(() =>
			assertHostedAuthProjectConfirmation({
				projectReference: "abcdefghijklmnopqrst",
				confirmation: "different-project",
			}),
		).toThrow("Refusing hosted Auth write");
		expect(() =>
			assertHostedAuthProjectConfirmation({
				projectReference: "abcdefghijklmnopqrst",
				confirmation: "abcdefghijklmnopqrst",
			}),
		).not.toThrow();
		expect(() =>
			assertHostedAuthProjectConfirmation({
				projectReference: "abcdefghijklmnopqrst",
				confirmation: undefined,
				dryRun: true,
			}),
		).not.toThrow();
	});
});
