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
					SUPABASE_AUTH_SMTP_ADMIN_EMAIL: "accounts@noreply.blendcalc.food",
					SUPABASE_AUTH_SMTP_HOST: "smtp.example.test",
				},
				{ smtp: true },
			),
		).toThrow("SUPABASE_AUTH_SMTP_PORT");
	});

	it("rejects a hosted Auth sender outside the accounts identity", () => {
		expect(() =>
			buildHostedAuthPatch(
				{
					SUPABASE_AUTH_SMTP_ADMIN_EMAIL: "moderation@noreply.blendcalc.food",
					SUPABASE_AUTH_SMTP_HOST: "smtp.resend.com",
					SUPABASE_AUTH_SMTP_PORT: "587",
					SUPABASE_AUTH_SMTP_USER: "resend",
					SUPABASE_AUTH_SMTP_PASS: "protected",
					SUPABASE_AUTH_SMTP_SENDER_NAME: "blendCalc",
				},
				{ smtp: true },
			),
		).toThrow("accounts@noreply.blendcalc.food");
	});

	it("adds only the source-controlled template fields when requested", () => {
		const templatePatch = {
			mailer_subjects_confirmation: "Confirm",
			mailer_templates_confirmation_content: "<p>Confirm</p>",
			mailer_notifications_password_changed_enabled: true,
		};

		expect(
			buildHostedAuthPatch({}, { templates: true }, templatePatch),
		).toEqual(templatePatch);
		expect(() => buildHostedAuthPatch({}, { templates: true })).toThrow(
			"template patch is empty",
		);
	});

	it("reports only safe hosted configuration status", () => {
		const expectedPatch = {
			security_captcha_secret: "never-report-this",
			smtp_admin_email: "accounts@noreply.blendcalc.food",
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
			smtp_admin_email: "accounts@noreply.blendcalc.food",
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
			smtp_admin_email: "accounts@noreply.blendcalc.food",
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

	it("verifies every requested template field exactly", () => {
		const expectedPatch = {
			mailer_subjects_confirmation: "Confirm",
			mailer_templates_confirmation_content: "<p>Confirm</p>",
			mailer_notifications_password_changed_enabled: true,
			mailer_notifications_phone_changed_enabled: false,
		};

		expect(
			summarizeHostedAuthConfiguration(
				expectedPatch,
				{ templates: true },
				expectedPatch,
			),
		).toEqual({ authEmailTemplatesConfigured: true });
		expect(
			summarizeHostedAuthConfiguration(
				{ ...expectedPatch, mailer_subjects_confirmation: "Old subject" },
				{ templates: true },
				expectedPatch,
			),
		).toEqual({ authEmailTemplatesConfigured: false });
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
