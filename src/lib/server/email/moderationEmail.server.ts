import { env } from "$env/dynamic/private";
import { APP_NAME } from "$lib/config/brand";
import { fetchWithExternalRequestPolicy } from "$lib/server/http/externalRequest.server";

export type ModerationReason =
	| "profile_image_policy_violation"
	| "harassment_or_abuse"
	| "fraud_or_spam"
	| "terms_violation";

type BlockEmailInput = {
	email: string;
	displayName: string;
	moderationActionId: string;
	reason: ModerationReason;
};

export type BlockEmailResult =
	| { status: "sent"; providerMessageId: string }
	| { status: "failed"; errorCode: string; errorMessage: string };

const REASON_DETAILS: Record<ModerationReason, { label: string; explanation: string }> = {
	profile_image_policy_violation: {
		label: "Profile image policy violation",
		explanation:
			"A profile image associated with your account violated our rules against explicit nudity, sexual content, graphic violence, or hate imagery.",
	},
	harassment_or_abuse: {
		label: "Harassment or abuse",
		explanation:
			"Activity associated with your account violated our rules against harassment, threats, or abusive behavior.",
	},
	fraud_or_spam: {
		label: "Fraud or spam",
		explanation:
			"Activity associated with your account was identified as fraudulent, deceptive, or unwanted spam.",
	},
	terms_violation: {
		label: "Terms violation",
		explanation:
			`Activity associated with your account violated the ${APP_NAME} community rules or terms of use.`,
	},
};

const escapeHtml = (value: string) => {
	return value.replace(/[&<>'"]/g, (character) => {
		const entities: Record<string, string> = {
			"&": "&amp;",
			"<": "&lt;",
			">": "&gt;",
			"'": "&#39;",
			'"': "&quot;",
		};
		return entities[character] ?? character;
	});
};

const getEmailConfiguration = () => {
	const apiKey = env.RESEND_API_KEY?.trim();
	const from = env.MODERATION_EMAIL_FROM?.trim();
	const supportEmail = env.MODERATION_SUPPORT_EMAIL?.trim();

	if (!apiKey || !from) {
		return {
			configured: false as const,
			errorMessage:
				"RESEND_API_KEY and MODERATION_EMAIL_FROM must be configured on the server.",
		};
	}

	return { configured: true as const, apiKey, from, supportEmail };
};

export const getModerationEmailConfigurationError = () => {
	const configuration = getEmailConfiguration();
	return configuration.configured ? null : configuration.errorMessage;
};

export const sendAccountBlockedEmail = async ({
	email,
	displayName,
	moderationActionId,
	reason,
}: BlockEmailInput): Promise<BlockEmailResult> => {
	const configuration = getEmailConfiguration();
	if (!configuration.configured) {
		return {
			status: "failed",
			errorCode: "email_not_configured",
			errorMessage: configuration.errorMessage,
		};
	}

	const reasonDetails = REASON_DETAILS[reason];
	const greetingName = displayName.trim() || "there";
	const supportText = configuration.supportEmail
		? `If you believe this was a mistake, contact ${configuration.supportEmail}.`
		: "If you believe this was a mistake, reply to this email.";
	const text = [
		`Hello ${greetingName},`,
		"",
		`Your ${APP_NAME} account has been blocked.`,
		"",
		`Reason: ${reasonDetails.label}`,
		reasonDetails.explanation,
		"",
		"You can no longer sign in or create another account with this email address.",
		supportText,
		"",
		`${APP_NAME} moderation`,
	].join("\n");
	const safeName = escapeHtml(greetingName);
	const safeReasonLabel = escapeHtml(reasonDetails.label);
	const safeExplanation = escapeHtml(reasonDetails.explanation);
	const safeSupportText = escapeHtml(supportText);
	let response: Response;
	try {
		response = await fetchWithExternalRequestPolicy(
			"https://api.resend.com/emails",
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${configuration.apiKey}`,
					"Content-Type": "application/json",
					"Idempotency-Key": `moderation-ban-${moderationActionId}`,
				},
				body: JSON.stringify({
					from: configuration.from,
					to: [email],
					subject: `Your ${APP_NAME} account was blocked`,
					text,
					html: `
					<div style="margin:0 auto;max-width:560px;padding:24px;font-family:Arial,sans-serif;color:#514a45;line-height:1.55">
					<p>Hello ${safeName},</p>
					<h1 style="font-size:24px;line-height:1.2">Your ${APP_NAME} account has been blocked</h1>
					<div style="margin:20px 0;padding:16px;border-left:4px solid #a96647;background:#fcf9f4">
						<strong>Reason: ${safeReasonLabel}</strong>
						<p style="margin:8px 0 0">${safeExplanation}</p>
					</div>
					<p>You can no longer sign in or create another account with this email address.</p>
					<p>${safeSupportText}</p>
					<p style="margin-top:28px;color:#766f69">${APP_NAME} moderation</p>
				</div>
				`,
					reply_to: configuration.supportEmail,
					tags: [{ name: "category", value: "account_blocked" }],
				}),
				timeoutMilliseconds: 10_000,
				maxAttempts: 2,
			},
		);
	} catch (error) {
		return {
			status: "failed",
			errorCode: "email_network_error",
			errorMessage: error instanceof Error ? error.message : "Email request failed.",
		};
	}

	const responseBody = (await response.json().catch(() => null)) as {
		id?: string;
		name?: string;
		message?: string;
	} | null;

	if (!response.ok || !responseBody?.id) {
		return {
			status: "failed",
			errorCode: responseBody?.name ?? `email_http_${response.status}`,
			errorMessage:
				responseBody?.message ?? "The email provider returned no message ID.",
		};
	}

	return { status: "sent", providerMessageId: responseBody.id };
};
