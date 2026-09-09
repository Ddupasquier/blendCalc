import { fetchWithExternalRequestPolicy } from "$lib/server/http/externalRequest.server";

const RESEND_EMAIL_ENDPOINT = "https://api.resend.com/emails";
export const TRANSACTIONAL_EMAIL_DOMAIN = "noreply.blendcalc.food";
export const TRANSACTIONAL_EMAIL_ADDRESSES = {
	accounts: `accounts@${TRANSACTIONAL_EMAIL_DOMAIN}`,
	moderation: `moderation@${TRANSACTIONAL_EMAIL_DOMAIN}`,
	operations: `operations@${TRANSACTIONAL_EMAIL_DOMAIN}`,
} as const;

export type TransactionalEmailResult =
	| { status: "sent"; providerMessageId: string }
	| { status: "failed"; errorCode: string; errorMessage: string };

type TransactionalEmailTag = { name: string; value: string };

type SendTransactionalEmailInput = {
	apiKey: string;
	from: string;
	to: string[];
	subject: string;
	text: string;
	html: string;
	idempotencyKey: string;
	replyTo?: string;
	tags?: TransactionalEmailTag[];
};

type TransactionalEmailLayoutInput = {
	eyebrow?: string;
	title: string;
	bodyHtml: string;
	footer?: string;
};

export const escapeEmailHtml = (value: string) =>
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

const extractEmailAddress = (sender: string) => {
	const bracketedAddress = sender.match(/<([^<>]+)>\s*$/)?.[1];
	return (bracketedAddress ?? sender).trim().toLowerCase();
};

export const isApprovedTransactionalSender = (
	sender: string,
	expectedAddress?: string,
) => {
	const emailAddress = extractEmailAddress(sender);
	return expectedAddress
		? emailAddress === expectedAddress.toLowerCase()
		: emailAddress.endsWith(`@${TRANSACTIONAL_EMAIL_DOMAIN}`);
};

export const renderTransactionalEmail = ({
	eyebrow,
	title,
	bodyHtml,
	footer = "This is a service message from blendCalc.",
}: TransactionalEmailLayoutInput) => `<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8">
		<meta name="viewport" content="width=device-width, initial-scale=1">
		<title>${escapeEmailHtml(title)}</title>
	</head>
	<body style="margin:0;background:#f8f8fb;color:#1a1a2e;font-family:Arial,Helvetica,sans-serif;line-height:1.55">
		<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f8f8fb">
			<tr>
				<td align="center" style="padding:32px 16px">
					<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#ffffff;border:1px solid #dedee6;border-top:6px solid #57a773;border-radius:20px">
						<tr>
							<td style="padding:32px">
								<p style="margin:0 0 24px;font-size:20px;font-weight:800;letter-spacing:-0.02em;color:#1a1a2e">blendCalc</p>
								${eyebrow ? `<p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#347b99">${escapeEmailHtml(eyebrow)}</p>` : ""}
								<h1 style="margin:0 0 20px;font-size:28px;line-height:1.2;letter-spacing:-0.02em;color:#1a1a2e">${escapeEmailHtml(title)}</h1>
								<div style="font-size:16px;color:#343449">${bodyHtml}</div>
							</td>
						</tr>
						<tr>
							<td style="padding:20px 32px;border-top:1px solid #e9e9ed;font-size:12px;color:#70758d">${escapeEmailHtml(footer)}</td>
						</tr>
					</table>
				</td>
			</tr>
		</table>
	</body>
</html>`;

export const sendTransactionalEmail = async ({
	apiKey,
	from,
	to,
	subject,
	text,
	html,
	idempotencyKey,
	replyTo,
	tags,
}: SendTransactionalEmailInput): Promise<TransactionalEmailResult> => {
	if (!isApprovedTransactionalSender(from)) {
		return {
			status: "failed",
			errorCode: "email_sender_not_approved",
			errorMessage: `Transactional email must use ${TRANSACTIONAL_EMAIL_DOMAIN}.`,
		};
	}

	let response: Response;
	try {
		response = await fetchWithExternalRequestPolicy(RESEND_EMAIL_ENDPOINT, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
				"Idempotency-Key": idempotencyKey,
			},
			body: JSON.stringify({
				from,
				to,
				subject,
				text,
				html,
				...(replyTo ? { reply_to: replyTo } : {}),
				...(tags?.length ? { tags } : {}),
			}),
			timeoutMilliseconds: 10_000,
			maxAttempts: 2,
		});
	} catch (error) {
		return {
			status: "failed",
			errorCode: "email_network_error",
			errorMessage:
				error instanceof Error ? error.message : "Email request failed.",
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
