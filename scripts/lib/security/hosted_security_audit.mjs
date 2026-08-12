/**
 * Purpose: Provide pure hosted-security evaluation helpers for the read-only audit.
 * Do not run directly; use
 * `node scripts/audits/security/audit_hosted_security.mjs`.
 */

const PRODUCTION_ORIGIN = "https://blendcalc.vercel.app";
const REQUIRED_REDIRECT_URLS = [
	`${PRODUCTION_ORIGIN}/auth/callback`,
	"http://localhost:5173/auth/callback",
	"http://localhost:5174/auth/callback",
];
const WORLD_OPEN_NETWORKS = new Set(["0.0.0.0/0", "::/0"]);
const MAXIMUM_BACKUP_AGE_MILLISECONDS = 36 * 60 * 60 * 1000;

const createFinding = (id, label, status, detail) => ({
	id,
	label,
	status,
	detail,
});

export const splitRedirectUrls = (value) =>
	String(value ?? "")
		.split(",")
		.map((redirectUrl) => redirectUrl.trim())
		.filter(Boolean);

const hasRestrictedPreviewCallback = (redirectUrls) =>
	redirectUrls.some((redirectUrl) => {
		if (!redirectUrl.includes("*")) return false;
		try {
			const parsedUrl = new URL(redirectUrl.replace("*", "preview"));
			return (
				parsedUrl.protocol === "https:" &&
				parsedUrl.hostname.endsWith(".vercel.app") &&
				parsedUrl.pathname === "/auth/callback"
			);
		} catch {
			return false;
		}
	});

const getNewestCompletedBackup = (backupConfiguration) =>
	(backupConfiguration?.backups ?? [])
		.filter(({ status }) => String(status).toUpperCase() === "COMPLETED")
		.sort(
			(left, right) =>
				new Date(right.inserted_at).getTime() -
				new Date(left.inserted_at).getTime(),
		)[0] ?? null;

const evaluateProjectHealth = (project) =>
	createFinding(
		"project-health",
		"Hosted project health",
		project?.status === "ACTIVE_HEALTHY" ? "pass" : "fail",
		project?.status === "ACTIVE_HEALTHY"
			? "The linked Supabase project reports healthy."
			: `The linked project reports ${project?.status ?? "an unknown status"}.`,
	);

const evaluateNetworkRestrictions = (networkRestrictions) => {
	const ipv4Networks = networkRestrictions?.config?.dbAllowedCidrs ?? [];
	const ipv6Networks = networkRestrictions?.config?.dbAllowedCidrsV6 ?? [];
	const allowedNetworks = [...ipv4Networks, ...ipv6Networks];
	const hasWorldOpenNetwork = allowedNetworks.some((network) =>
		WORLD_OPEN_NETWORKS.has(network),
	);
	const isRestricted =
		networkRestrictions?.status === "applied" &&
		allowedNetworks.length > 0 &&
		!hasWorldOpenNetwork;

	return createFinding(
		"database-network-restrictions",
		"Direct database access",
		isRestricted ? "pass" : "fail",
		isRestricted
			? `Restricted to ${ipv4Networks.length} IPv4 and ${ipv6Networks.length} IPv6 trusted network entries.`
			: "Direct Postgres access is missing an applied trusted-network allowlist or remains open to the internet.",
	);
};

const evaluateBackups = (backupConfiguration, now) => {
	const newestBackup = getNewestCompletedBackup(backupConfiguration);
	const backupTime = newestBackup
		? new Date(newestBackup.inserted_at).getTime()
		: Number.NaN;
	const ageMilliseconds = now.getTime() - backupTime;
	const isRecent =
		Number.isFinite(ageMilliseconds) &&
		ageMilliseconds >= 0 &&
		ageMilliseconds <= MAXIMUM_BACKUP_AGE_MILLISECONDS;

	return [
		createFinding(
			"managed-database-backups",
			"Managed database backups",
			isRecent ? "pass" : "fail",
			isRecent
				? `The newest completed physical backup is ${Math.round(ageMilliseconds / 3_600_000)} hours old.`
				: "No completed physical backup was found within the last 36 hours.",
		),
		createFinding(
			"point-in-time-recovery",
			"Point-in-time recovery",
			backupConfiguration?.pitr_enabled ? "pass" : "info",
			backupConfiguration?.pitr_enabled
				? "Point-in-time recovery is enabled."
				: "Point-in-time recovery is not enabled; verified daily backups remain the MVP recovery policy.",
		),
	];
};

const evaluateAuthConfiguration = (authConfiguration) => {
	const redirectUrls = splitRedirectUrls(authConfiguration?.uri_allow_list);
	const missingRedirectUrls = REQUIRED_REDIRECT_URLS.filter(
		(requiredUrl) => !redirectUrls.includes(requiredUrl),
	);
	const callbackConfigurationIsComplete =
		authConfiguration?.site_url === PRODUCTION_ORIGIN &&
		missingRedirectUrls.length === 0 &&
		hasRestrictedPreviewCallback(redirectUrls);
	const refreshTokenConfigurationIsSafe =
		authConfiguration?.refresh_token_rotation_enabled === true &&
		Number(authConfiguration?.security_refresh_token_reuse_interval) <= 10;
	const rateLimitsAreConfigured = [
		authConfiguration?.rate_limit_email_sent,
		authConfiguration?.rate_limit_otp,
		authConfiguration?.rate_limit_token_refresh,
		authConfiguration?.rate_limit_verify,
	].every((value) => Number.isFinite(Number(value)) && Number(value) > 0);
	const customSmtpIsConfigured = [
		authConfiguration?.smtp_admin_email,
		authConfiguration?.smtp_host,
		authConfiguration?.smtp_pass,
		authConfiguration?.smtp_user,
	].every((value) => String(value ?? "").trim().length > 0);

	return [
		createFinding(
			"auth-callbacks",
			"Authentication callbacks",
			callbackConfigurationIsComplete ? "pass" : "fail",
			callbackConfigurationIsComplete
				? "Production, local development, isolated browser testing, and restricted Vercel preview callbacks are allowed."
				: "The canonical site URL or one or more required callback URLs are missing.",
		),
		createFinding(
			"email-confirmation",
			"Email confirmation",
			authConfiguration?.mailer_autoconfirm === false ? "pass" : "fail",
			authConfiguration?.mailer_autoconfirm === false
				? "New password accounts must confirm their email address."
				: "New password accounts can become active without email confirmation.",
		),
		createFinding(
			"password-policy",
			"Password policy",
			Number(authConfiguration?.password_min_length) >= 15 &&
				authConfiguration?.password_hibp_enabled === true &&
				authConfiguration?.security_update_password_require_reauthentication === true
				? "pass"
				: "fail",
			"Requires 15-character passphrases, breached-password screening, and secure password changes.",
		),
		createFinding(
			"refresh-token-protection",
			"Refresh-token protection",
			refreshTokenConfigurationIsSafe ? "pass" : "fail",
			refreshTokenConfigurationIsSafe
				? "Refresh-token rotation and a maximum 10-second reuse window are enabled."
				: "Refresh-token rotation or reuse detection is weaker than the approved baseline.",
		),
		createFinding(
			"auth-rate-limits",
			"Authentication rate limits",
			rateLimitsAreConfigured ? "pass" : "fail",
			rateLimitsAreConfigured
				? "Email, verification, token-refresh, and OTP requests have hosted limits."
				: "One or more hosted authentication request limits are missing.",
		),
		createFinding(
			"captcha-protection",
			"Bot protection",
			authConfiguration?.security_captcha_enabled === true ? "pass" : "blocked",
			authConfiguration?.security_captcha_enabled === true
				? `${authConfiguration?.security_captcha_provider ?? "CAPTCHA"} protection is enabled.`
				: "CAPTCHA remains disabled until the browser token flow and provider keys are configured together.",
		),
		createFinding(
			"totp-capability",
			"TOTP capability",
			authConfiguration?.mfa_totp_enroll_enabled === true &&
				authConfiguration?.mfa_totp_verify_enabled === true &&
				authConfiguration?.mfa_allow_low_aal === false
				? "pass"
				: "fail",
			"TOTP enrollment and verification must be available without accepting low-assurance MFA sessions.",
		),
		createFinding(
			"privileged-mfa-enforcement",
			"Privileged-account MFA",
			"blocked",
			"Application enrollment, challenge, recovery guidance, and AAL2 enforcement are implemented; every elevated production account still needs verified factor enrollment.",
		),
		createFinding(
			"custom-smtp",
			"Production email delivery",
			customSmtpIsConfigured ? "pass" : "blocked",
			customSmtpIsConfigured
				? "Custom SMTP is configured for confirmation and recovery messages."
				: "Custom SMTP provider credentials are not configured in hosted Auth.",
		),
	];
};

export const evaluateHostedSecuritySnapshot = (
	{ project, networkRestrictions, backupConfiguration, authConfiguration },
	{ now = new Date() } = {},
) => {
	const findings = [
		evaluateProjectHealth(project),
		evaluateNetworkRestrictions(networkRestrictions),
		...evaluateBackups(backupConfiguration, now),
		...evaluateAuthConfiguration(authConfiguration),
		createFinding(
			"auth-audit-events",
			"Authentication audit events",
			"info",
			"Supabase external Auth audit events are available; review retention and suspicious-event procedures in the security runbook.",
		),
	];
	const summary = findings.reduce(
		(counts, finding) => {
			counts[finding.status] += 1;
			return counts;
		},
		{ pass: 0, fail: 0, blocked: 0, info: 0 },
	);

	return { findings, summary };
};

export const getSerializableHostedSecuritySnapshot = ({
	project,
	networkRestrictions,
	backupConfiguration,
	authConfiguration,
}) => ({
	project: {
		id: project?.id ?? null,
		name: project?.name ?? null,
		region: project?.region ?? null,
		status: project?.status ?? null,
		databaseVersion: project?.database?.version ?? null,
	},
	networkRestrictions: {
		status: networkRestrictions?.status ?? null,
		ipv4EntryCount:
			networkRestrictions?.config?.dbAllowedCidrs?.length ?? 0,
		ipv6EntryCount:
			networkRestrictions?.config?.dbAllowedCidrsV6?.length ?? 0,
	},
	backupConfiguration: {
		backups: (backupConfiguration?.backups ?? []).map(
			({ id, inserted_at, is_physical_backup, status }) => ({
				id,
				insertedAt: inserted_at,
				isPhysicalBackup: is_physical_backup,
				status,
			}),
		),
		pitrEnabled: backupConfiguration?.pitr_enabled === true,
		walgEnabled: backupConfiguration?.walg_enabled === true,
	},
	authConfiguration: {
		siteUrl: authConfiguration?.site_url ?? null,
		redirectUrls: splitRedirectUrls(authConfiguration?.uri_allow_list),
		emailConfirmationRequired:
			authConfiguration?.mailer_autoconfirm === false,
		minimumPasswordLength: authConfiguration?.password_min_length ?? null,
		breachedPasswordScreeningEnabled:
			authConfiguration?.password_hibp_enabled === true,
		securePasswordChangesEnabled:
			authConfiguration?.security_update_password_require_reauthentication ===
			true,
		refreshTokenRotationEnabled:
			authConfiguration?.refresh_token_rotation_enabled === true,
		refreshTokenReuseIntervalSeconds:
			authConfiguration?.security_refresh_token_reuse_interval ?? null,
		captchaEnabled: authConfiguration?.security_captcha_enabled === true,
		captchaProvider: authConfiguration?.security_captcha_provider ?? null,
		totpEnrollmentEnabled:
			authConfiguration?.mfa_totp_enroll_enabled === true,
		totpVerificationEnabled:
			authConfiguration?.mfa_totp_verify_enabled === true,
		lowAssuranceMfaAllowed: authConfiguration?.mfa_allow_low_aal === true,
		customSmtpConfigured: [
			authConfiguration?.smtp_admin_email,
			authConfiguration?.smtp_host,
			authConfiguration?.smtp_pass,
			authConfiguration?.smtp_user,
		].every((value) => String(value ?? "").trim().length > 0),
	},
});
