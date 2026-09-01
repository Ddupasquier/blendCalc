import { describe, expect, it } from "vitest";
import {
	evaluateHostedSecuritySnapshot,
	getSerializableHostedSecuritySnapshot,
} from "../../scripts/lib/security/hosted_security_audit.mjs";

const createSecureSnapshot = () => ({
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
		smtp_admin_email: "security@example.test",
		smtp_host: "smtp.example.test",
		smtp_pass: "never-serialize-this-either",
		smtp_user: "blendcalc",
	},
	privilegedMfaSummary: {
		checked: true,
		elevatedAccountCount: 3,
		verifiedTotpAccountCount: 3,
		userIds: ["never-serialize-this-user-id"],
	},
});

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

	it("never serializes hosted secrets or trusted network addresses", () => {
		const serializedSnapshot = JSON.stringify(
			getSerializableHostedSecuritySnapshot(createSecureSnapshot()),
		);

		expect(serializedSnapshot).not.toContain("192.0.2.10");
		expect(serializedSnapshot).not.toContain("never-serialize-this");
		expect(serializedSnapshot).not.toContain("never-serialize-this-user-id");
		expect(serializedSnapshot).toContain('"ipv4EntryCount":1');
		expect(serializedSnapshot).toContain('"customSmtpConfigured":true');
		expect(serializedSnapshot).toContain('"verifiedTotpAccountCount":3');
	});
});
