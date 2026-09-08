/**
 * Purpose: Check a hosted SMTP sender against its provider without exposing
 * credentials or raw provider responses. Used by the hosted-security audit.
 * Do not run directly.
 */

const RESEND_SMTP_HOST = "smtp.resend.com";
const RESEND_DOMAINS_ENDPOINT = "https://api.resend.com/domains";
const RESEND_DOMAIN_PAGE_SIZE = 100;
const MAXIMUM_RESEND_DOMAIN_PAGES = 10;
const KNOWN_RESEND_DOMAIN_STATUSES = new Set([
	"not_started",
	"pending",
	"verified",
	"partially_verified",
	"partially_failed",
	"failed",
	"temporary_failure",
]);
const KNOWN_SENDING_CAPABILITIES = new Set(["enabled", "disabled"]);

const normalizeText = (value) => String(value ?? "").trim();

const getSenderDomain = (emailAddress) => {
	const normalizedEmailAddress = normalizeText(emailAddress).toLowerCase();
	const separatorIndex = normalizedEmailAddress.lastIndexOf("@");
	if (
		separatorIndex <= 0 ||
		separatorIndex === normalizedEmailAddress.length - 1 ||
		normalizedEmailAddress.includes(" ")
	) {
		return null;
	}
	return normalizedEmailAddress.slice(separatorIndex + 1);
};

const createReadiness = ({
	checked,
	ready = false,
	provider = null,
	senderDomain = null,
	domainStatus = null,
	sendingCapability = null,
	reason,
}) => ({
	checked,
	ready,
	provider,
	senderDomain,
	domainStatus,
	sendingCapability,
	reason,
});

const sanitizeDomainStatus = (value) => {
	const status = normalizeText(value).toLowerCase();
	return KNOWN_RESEND_DOMAIN_STATUSES.has(status) ? status : "unknown";
};

const sanitizeSendingCapability = (value) => {
	const capability = normalizeText(value).toLowerCase();
	return KNOWN_SENDING_CAPABILITIES.has(capability) ? capability : "unknown";
};

export const checkSmtpProviderReadiness = async (
	{ smtpHost, smtpAdminEmail, providerCredential },
	{ fetchImplementation = fetch } = {},
) => {
	const normalizedSmtpHost = normalizeText(smtpHost).toLowerCase();
	const senderDomain = getSenderDomain(smtpAdminEmail);

	if (normalizedSmtpHost !== RESEND_SMTP_HOST) {
		return createReadiness({
			checked: false,
			senderDomain,
			reason: "unsupported-provider",
		});
	}
	if (!senderDomain) {
		return createReadiness({
			checked: false,
			provider: "resend",
			reason: "invalid-sender-domain",
		});
	}
	if (!normalizeText(providerCredential)) {
		return createReadiness({
			checked: false,
			provider: "resend",
			senderDomain,
			reason: "provider-credential-unavailable",
		});
	}

	try {
		let afterDomainId = null;
		for (let page = 0; page < MAXIMUM_RESEND_DOMAIN_PAGES; page += 1) {
			const endpoint = new URL(RESEND_DOMAINS_ENDPOINT);
			endpoint.searchParams.set("limit", String(RESEND_DOMAIN_PAGE_SIZE));
			if (afterDomainId) endpoint.searchParams.set("after", afterDomainId);

			const response = await fetchImplementation(endpoint, {
				headers: { Authorization: `Bearer ${providerCredential}` },
				signal: AbortSignal.timeout(15_000),
			});
			if (!response.ok) {
				return createReadiness({
					checked: false,
					provider: "resend",
					senderDomain,
					reason: "provider-request-failed",
				});
			}

			const providerResponse = await response.json();
			if (!Array.isArray(providerResponse?.data)) {
				return createReadiness({
					checked: false,
					provider: "resend",
					senderDomain,
					reason: "provider-response-invalid",
				});
			}

			const matchingDomain = providerResponse.data.find(
				(domain) => normalizeText(domain?.name).toLowerCase() === senderDomain,
			);
			if (matchingDomain) {
				const domainStatus = sanitizeDomainStatus(matchingDomain.status);
				const sendingCapability = sanitizeSendingCapability(
					matchingDomain.capabilities?.sending,
				);
				const ready =
					domainStatus === "verified" && sendingCapability === "enabled";
				return createReadiness({
					checked: true,
					ready,
					provider: "resend",
					senderDomain,
					domainStatus,
					sendingCapability,
					reason: ready ? "provider-ready" : "provider-domain-not-ready",
				});
			}

			if (providerResponse.has_more !== true) {
				return createReadiness({
					checked: true,
					provider: "resend",
					senderDomain,
					domainStatus: "missing",
					reason: "provider-domain-not-found",
				});
			}

			afterDomainId = normalizeText(providerResponse.data.at(-1)?.id);
			if (!afterDomainId) {
				return createReadiness({
					checked: false,
					provider: "resend",
					senderDomain,
					reason: "provider-response-invalid",
				});
			}
		}

		return createReadiness({
			checked: false,
			provider: "resend",
			senderDomain,
			reason: "provider-pagination-limit",
		});
	} catch {
		return createReadiness({
			checked: false,
			provider: "resend",
			senderDomain,
			reason: "provider-request-failed",
		});
	}
};
