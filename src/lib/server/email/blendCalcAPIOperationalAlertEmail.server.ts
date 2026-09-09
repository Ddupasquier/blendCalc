import { createHash } from "node:crypto";
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
import type { BlendCalcAPIOperationalAlert } from "$lib/server/blendCalcAPI/operations/blendCalcAPIOperationalAlerts.server";

type AlertEmailResult = TransactionalEmailResult;

const configuration = () => {
	const apiKey = env.RESEND_API_KEY?.trim();
	const from = env.API_ALERT_EMAIL_FROM?.trim();
	const to = (env.API_ALERT_EMAIL_TO ?? "")
		.split(",")
		.map((value) => value.trim())
		.filter(Boolean);
	if (
		!apiKey ||
		!from ||
		!isApprovedTransactionalSender(
			from,
			TRANSACTIONAL_EMAIL_ADDRESSES.operations,
		) ||
		to.length === 0
	) {
		return {
			configured: false as const,
			errorMessage: `RESEND_API_KEY and API_ALERT_EMAIL_TO must be configured, and API_ALERT_EMAIL_FROM must use ${TRANSACTIONAL_EMAIL_ADDRESSES.operations}.`,
		};
	}
	return { configured: true as const, apiKey, from, to };
};

export const sendBlendCalcAPIOperationalAlertEmail = async (input: {
	alerts: BlendCalcAPIOperationalAlert[];
	checkedAt: string;
}): Promise<AlertEmailResult> => {
	const email = configuration();
	if (!email.configured) {
		return {
			status: "failed",
			errorCode: "email_not_configured",
			errorMessage: email.errorMessage,
		};
	}
	const criticalCount = input.alerts.filter(
		(alert) => alert.severity === "critical",
	).length;
	const text = input.alerts
		.map(
			(alert) =>
				`[${alert.severity.toUpperCase()}] ${alert.title}\n${alert.summary}`,
		)
		.join("\n\n");
	const html = input.alerts
		.map(
			(alert) =>
				`<li style="margin:0 0 16px"><strong>${escapeEmailHtml(alert.title)}</strong><br><span>${escapeEmailHtml(alert.summary)}</span></li>`,
		)
		.join("");
	const bucket = input.checkedAt.slice(0, 13).replace(/\D/g, "");
	const fingerprint = createHash("sha256")
		.update(
			input.alerts
				.map((alert) => `${alert.code}:${alert.severity}`)
				.sort()
				.join("|"),
		)
		.digest("hex")
		.slice(0, 24);

	return sendTransactionalEmail({
		apiKey: email.apiKey,
		from: email.from,
		to: email.to,
		subject: `${criticalCount > 0 ? "Critical" : "Warning"}: ${APP_NAME} API operations (${input.alerts.length})`,
		text: `${text}\n\nChecked at ${input.checkedAt}.`,
		html: renderTransactionalEmail({
			eyebrow: "Operations alert",
			title: `${APP_NAME} API operations`,
			bodyHtml: `<ol style="margin:0;padding-left:22px">${html}</ol><p style="margin:24px 0 0;color:#70758d">Checked at ${escapeEmailHtml(input.checkedAt)}.</p>`,
			footer: `${APP_NAME} operations · Internal service notification.`,
		}),
		idempotencyKey: `api-alert-${bucket}-${fingerprint}`,
		tags: [{ name: "category", value: "api_operations" }],
	});
};
