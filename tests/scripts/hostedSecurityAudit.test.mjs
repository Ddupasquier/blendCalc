import { describe, expect, it } from "vitest";
import {
	evaluateHostedSecuritySnapshot,
	getSerializableHostedSecuritySnapshot,
} from "../../scripts/lib/security/hosted_security_audit.mjs";
import { checkSmtpProviderReadiness } from "../../scripts/lib/security/smtp_provider_readiness.mjs";
import { getAuthEmailTemplatePatch } from "../../scripts/lib/auth/auth_email_templates.mjs";

const createSecureSnapshot = () => {
	const authEmailTemplatePatch = getAuthEmailTemplatePatch();
	return {
		project: {
			id: "project-ref",
			name: "blendCalc",
			region: "us-west-2",
			status: "ACTIVE_HEALTHY",
			database: { version: "17.6" },
		},
		networkRestrictions: {
			status: "applied",
			config: { dbAllowedCidrs: ["192.0.2.10/32"], dbAllowedCidrsV6: [] },
		},
		backupConfiguration: {
			backups: [
				{
					id: 1,
					inserted_at: "2026-08-11T12:00:00.000Z",
					is_physical_backup: true,
					status: "COMPLETED",
				},
			],
			pitr_enabled: false,
			walg_enabled: true,
		},
		authConfiguration: {
			...authEmailTemplatePatch,
			site_url: "https://www.blendcalc.food",
			uri_allow_list:
				"https://www.blendcalc.food/auth/callback,http://localhost:5173/auth/callback,http://localhost:5174/auth/callback,https://*-account.vercel.app/auth/callback",
			mailer_autoconfirm: false,
			password_min_length: 15,
			password_hibp_enabled: true,
			security_update_password_require_reauthentication: true,
			refresh_token_rotation_enabled: true,
			security_refresh_token_reuse_interval: 10,
			rate_limit_email_sent: 2,
			rate_limit_otp: 30,
			rate_limit_token_refresh: 150,
			rate_limit_verify: 30,
			security_captcha_enabled: true,
			security_captcha_provider: "turnstile",
			security_captcha_secret: "never-serialize-this",
			mfa_totp_enroll_enabled: true,
			mfa_totp_verify_enabled: true,
			mfa_allow_low_aal: false,
			smtp_admin_email: "accounts@noreply.blendcalc.food",
			smtp_host: "smtp.example.test",
			smtp_port: "587",
			smtp_pass: "never-serialize-this-either",
			smtp_user: "blendcalc",
			smtp_sender_name: "blendCalc",
		},
		privilegedMfaSummary: {
			checked: true,
			elevatedAccountCount: 3,
			verifiedTotpAccountCount: 3,
			userIds: ["never-serialize-this-user-id"],
		},
		smtpProviderReadiness: {
			checked: true,
			provider: "resend",
			senderDomain: "noreply.blendcalc.food",
			domainStatus: "verified",
			sendingCapability: "enabled",
			ready: true,
			reason: "provider-ready",
		},
		authEmailTemplatePatch,
	};
};

describe("hosted security audit", () => {
	it("recognizes the approved hosted security baseline", () => {
		const report = evaluateHostedSecuritySnapshot(createSecureSnapshot(), {
			now: new Date("2026-08-11T20:00:00.000Z"),
		});

		expect(report.summary.fail).toBe(0);
		expect(
			report.findings.find(({ id }) => id === "database-network-restrictions")
				?.status,
		).toBe("pass");
		expect(
			report.findings.find(({ id }) => id === "password-policy")?.status,
		).toBe("pass");
		expect(
			report.findings.find(({ id }) => id === "privileged-mfa-enforcement")
				?.status,
		).toBe("pass");
	});

	it("fails when hosted Auth drifts from the tracked email catalog", () => {
		const snapshot = createSecureSnapshot();
		snapshot.authConfiguration.mailer_subjects_recovery = "Old subject";

		const report = evaluateHostedSecuritySnapshot(snapshot, {
			now: new Date("2026-08-11T20:00:00.000Z"),
		});

		expect(
			report.findings.find(({ id }) => id === "auth-email-templates")?.status,
		).toBe("fail");
	});

	it("fails when an elevated account has no verified TOTP factor", () => {
		const snapshot = createSecureSnapshot();
		snapshot.privilegedMfaSummary.verifiedTotpAccountCount = 2;

		const report = evaluateHostedSecuritySnapshot(snapshot, {
			now: new Date("2026-08-11T20:00:00.000Z"),
		});

		expect(
			report.findings.find(({ id }) => id === "privileged-mfa-enforcement")
				?.status,
		).toBe("fail");
	});

	it("blocks enrollment verification when protected credentials are unavailable", () => {
		const snapshot = createSecureSnapshot();
		snapshot.privilegedMfaSummary = {
			checked: false,
			elevatedAccountCount: null,
			verifiedTotpAccountCount: null,
		};

		const report = evaluateHostedSecuritySnapshot(snapshot, {
			now: new Date("2026-08-11T20:00:00.000Z"),
		});

		expect(
			report.findings.find(({ id }) => id === "privileged-mfa-enforcement")
				?.status,
		).toBe("blocked");
	});

	it("fails world-open database access and stale backups", () => {
		const snapshot = createSecureSnapshot();
		snapshot.networkRestrictions.config.dbAllowedCidrs = ["0.0.0.0/0"];
		snapshot.backupConfiguration.backups[0].inserted_at =
			"2026-08-01T12:00:00.000Z";
		const report = evaluateHostedSecuritySnapshot(snapshot, {
			now: new Date("2026-08-11T20:00:00.000Z"),
		});

		expect(
			report.findings.find(({ id }) => id === "database-network-restrictions")
				?.status,
		).toBe("fail");
		expect(
			report.findings.find(({ id }) => id === "managed-database-backups")
				?.status,
		).toBe("fail");
	});

	it("blocks credentials-only SMTP configuration without provider evidence", () => {
		const snapshot = createSecureSnapshot();
		snapshot.smtpProviderReadiness = {
			checked: false,
			ready: false,
			provider: "resend",
			senderDomain: "noreply.example.test",
			reason: "provider-request-failed",
		};

		const report = evaluateHostedSecuritySnapshot(snapshot, {
			now: new Date("2026-08-11T20:00:00.000Z"),
		});
		const smtpFinding = report.findings.find(({ id }) => id === "custom-smtp");

		expect(smtpFinding).toMatchObject({
			status: "blocked",
			label: "Production email sender readiness",
		});
		expect(smtpFinding?.detail).toContain(
			"provider delivery readiness could not be verified",
		);
	});

	it("fails when the provider reports that the sender domain is not ready", () => {
		const snapshot = createSecureSnapshot();
		snapshot.smtpProviderReadiness = {
			checked: true,
			ready: false,
			provider: "resend",
			senderDomain: "noreply.example.test",
			domainStatus: "pending",
			sendingCapability: "enabled",
			reason: "provider-domain-not-ready",
		};

		const report = evaluateHostedSecuritySnapshot(snapshot, {
			now: new Date("2026-08-11T20:00:00.000Z"),
		});

		expect(report.findings.find(({ id }) => id === "custom-smtp")?.status).toBe(
			"fail",
		);
	});

	it("blocks SMTP when a required hosted field is absent", () => {
		const snapshot = createSecureSnapshot();
		snapshot.authConfiguration.smtp_sender_name = "";

		const report = evaluateHostedSecuritySnapshot(snapshot, {
			now: new Date("2026-08-11T20:00:00.000Z"),
		});

		expect(
			report.findings.find(({ id }) => id === "custom-smtp"),
		).toMatchObject({
			status: "blocked",
			detail:
				"Custom SMTP is incomplete or does not use accounts@noreply.blendcalc.food.",
		});
	});

	it("blocks SMTP when hosted Auth uses the wrong local sender identity", () => {
		const snapshot = createSecureSnapshot();
		snapshot.authConfiguration.smtp_admin_email =
			"moderation@noreply.blendcalc.food";

		const report = evaluateHostedSecuritySnapshot(snapshot, {
			now: new Date("2026-08-11T20:00:00.000Z"),
		});

		expect(
			report.findings.find(({ id }) => id === "custom-smtp"),
		).toMatchObject({ status: "blocked" });
	});

	it("checks Resend readiness without returning the provider credential", async () => {
		const providerCredential = "never-return-this-provider-credential";
		const fetchImplementation = async (endpoint, options) => {
			expect(String(endpoint)).toContain("https://api.resend.com/domains");
			expect(options.headers.Authorization).toBe(
				`Bearer ${providerCredential}`,
			);
			return {
				ok: true,
				json: async () => ({
					has_more: false,
					data: [
						{
							id: "domain-id",
							name: "noreply.example.test",
							status: "verified",
							capabilities: { sending: "enabled" },
						},
					],
				}),
			};
		};

		const readiness = await checkSmtpProviderReadiness(
			{
				smtpHost: "smtp.resend.com",
				smtpAdminEmail: "accounts@noreply.example.test",
				providerCredential,
			},
			{ fetchImplementation },
		);

		expect(readiness).toEqual({
			checked: true,
			ready: true,
			provider: "resend",
			senderDomain: "noreply.example.test",
			domainStatus: "verified",
			sendingCapability: "enabled",
			reason: "provider-ready",
		});
		expect(JSON.stringify(readiness)).not.toContain(providerCredential);
	});

	it("returns a safe failure when Resend cannot verify its domain inventory", async () => {
		const readiness = await checkSmtpProviderReadiness(
			{
				smtpHost: "smtp.resend.com",
				smtpAdminEmail: "accounts@noreply.example.test",
				providerCredential: "never-return-this-provider-credential",
			},
			{
				fetchImplementation: async () => ({ ok: false, status: 403 }),
			},
		);

		expect(readiness).toEqual({
			checked: false,
			ready: false,
			provider: "resend",
			senderDomain: "noreply.example.test",
			domainStatus: null,
			sendingCapability: null,
			reason: "provider-request-failed",
		});
	});

	it("reports a present but pending Resend sender domain as not ready", async () => {
		const readiness = await checkSmtpProviderReadiness(
			{
				smtpHost: "smtp.resend.com",
				smtpAdminEmail: "accounts@noreply.example.test",
				providerCredential: "never-return-this-provider-credential",
			},
			{
				fetchImplementation: async () => ({
					ok: true,
					json: async () => ({
						has_more: false,
						data: [
							{
								id: "domain-id",
								name: "noreply.example.test",
								status: "pending",
								capabilities: { sending: "enabled" },
							},
						],
					}),
				}),
			},
		);

		expect(readiness).toMatchObject({
			checked: true,
			ready: false,
			domainStatus: "pending",
			sendingCapability: "enabled",
			reason: "provider-domain-not-ready",
		});
	});

	it("never serializes hosted secrets or trusted network addresses", () => {
		const serializedSnapshot = JSON.stringify(
			getSerializableHostedSecuritySnapshot(createSecureSnapshot()),
		);

		expect(serializedSnapshot).not.toContain("192.0.2.10");
		expect(serializedSnapshot).not.toContain("never-serialize-this");
		expect(serializedSnapshot).not.toContain("never-serialize-this-user-id");
		expect(serializedSnapshot).toContain('"ipv4EntryCount":1');
		expect(serializedSnapshot).toContain('"customSmtpConfigured":true');
		expect(serializedSnapshot).toContain('"ready":true');
		expect(serializedSnapshot).toContain('"verifiedTotpAccountCount":3');
	});
});
