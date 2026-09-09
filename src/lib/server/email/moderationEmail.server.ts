import { env } from "$env/dynamic/private";
import { APP_NAME } from "$lib/config/brand";
import {
	escapeEmailHtml,
	isApprovedTransactionalSender,
	renderTransactionalEmail,
	sendTransactionalEmail,
	TRANSACTIONAL_EMAIL_ADDRESSES,
	type TransactionalEmailResult,
} from "$lib/server/email/transactionalEmail.server";

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

export type BlockEmailResult = TransactionalEmailResult;

const REASON_DETAILS: Record<
	ModerationReason,
	{ label: string; explanation: string }
> = {
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
		explanation: `Activity associated with your account violated the ${APP_NAME} community rules or terms of use.`,
	},
};

const getEmailConfiguration = () => {
	const apiKey = env.RESEND_API_KEY?.trim();
	const from = env.MODERATION_EMAIL_FROM?.trim();
	const supportEmail = env.MODERATION_SUPPORT_EMAIL?.trim();

	if (
		!apiKey ||
		!from ||
		!isApprovedTransactionalSender(
			from,
			TRANSACTIONAL_EMAIL_ADDRESSES.moderation,
		)
	) {
		return {
			configured: false as const,
			errorMessage: `RESEND_API_KEY must be configured and MODERATION_EMAIL_FROM must use ${TRANSACTIONAL_EMAIL_ADDRESSES.moderation}.`,
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
	return sendTransactionalEmail({
		apiKey: configuration.apiKey,
		from: configuration.from,
		to: [email],
		subject: `Your ${APP_NAME} account was blocked`,
		text,
		html: renderTransactionalEmail({
			eyebrow: "Account notice",
			title: `Your ${APP_NAME} account was blocked`,
			bodyHtml: `
				<p style="margin:0 0 16px">Hello ${escapeEmailHtml(greetingName)},</p>
				<div style="margin:20px 0;padding:16px;border-left:4px solid #9c5f46;background:#fff4f1;border-radius:8px">
					<strong>Reason: ${escapeEmailHtml(reasonDetails.label)}</strong>
					<p style="margin:8px 0 0">${escapeEmailHtml(reasonDetails.explanation)}</p>
				</div>
				<p>You can no longer sign in or create another account with this email address.</p>
				<p style="margin-bottom:0">${escapeEmailHtml(supportText)}</p>`,
			footer: `${APP_NAME} moderation · This message concerns your account.`,
		}),
		idempotencyKey: `moderation-ban-${moderationActionId}`,
		replyTo: configuration.supportEmail,
		tags: [{ name: "category", value: "account_blocked" }],
	});
};
