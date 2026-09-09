import { createHash } from "node:crypto";
import { env } from "$env/dynamic/private";
import { APP_NAME } from "$lib/config/brand";
import { fetchWithExternalRequestPolicy } from "$lib/server/http/externalRequest.server";
import type { BlendCalcAPIOperationalAlert } from "$lib/server/blendCalcAPI/operations/blendCalcAPIOperationalAlerts.server";

type AlertEmailResult =
	| { status: "sent"; providerMessageId: string }
	| { status: "failed"; errorCode: string; errorMessage: string };

const escapeHtml = (value: string) =>
	value.replace(
		/[&<>'"]/g,
		(character) =>
			({
				"&": "&amp;",
				"<": "&lt;",
				">": "&gt;",
				"'": "&#39;",
				'"': "&quot;",
			})[character] ?? character,
	);

const configuration = () => {
	const apiKey = env.RESEND_API_KEY?.trim();
	const from = env.API_ALERT_EMAIL_FROM?.trim();
	const to = (env.API_ALERT_EMAIL_TO ?? "")
		.split(",")
		.map((value) => value.trim())
		.filter(Boolean);
	if (!apiKey || !from || to.length === 0) {
		return {
			configured: false as const,
			errorMessage:
				"RESEND_API_KEY, API_ALERT_EMAIL_FROM, and API_ALERT_EMAIL_TO must be configured.",
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
				`<li style="margin:0 0 16px"><strong>${escapeHtml(alert.title)}</strong><br><span>${escapeHtml(alert.summary)}</span></li>`,
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

	try {
		const response = await fetchWithExternalRequestPolicy(
			"https://api.resend.com/emails",
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${email.apiKey}`,
					"Content-Type": "application/json",
					"Idempotency-Key": `api-alert-${bucket}-${fingerprint}`,
				},
				body: JSON.stringify({
					from: email.from,
					to: email.to,
					subject: `${criticalCount > 0 ? "Critical" : "Warning"}: ${APP_NAME} API operations (${input.alerts.length})`,
					text: `${text}\n\nChecked at ${input.checkedAt}.`,
					html: `<div style="margin:0 auto;max-width:640px;padding:24px;font-family:Arial,sans-serif;color:#29252f;line-height:1.5"><h1 style="font-size:24px">${escapeHtml(APP_NAME)} API operations</h1><ol>${html}</ol><p style="color:#6b6474">Checked at ${escapeHtml(input.checkedAt)}.</p></div>`,
					tags: [{ name: "category", value: "api_operations" }],
				}),
				timeoutMilliseconds: 10_000,
				maxAttempts: 2,
			},
		);
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
	} catch (error) {
		return {
			status: "failed",
			errorCode: "email_network_error",
			errorMessage:
				error instanceof Error ? error.message : "Email request failed.",
		};
	}
};
