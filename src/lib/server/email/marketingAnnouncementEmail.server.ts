import { escapeEmailHtml } from "$lib/server/email/transactionalEmail.server";
import type { MarketingEmailTopicKey } from "$lib/utils/email/marketingEmailPreferences";

export const MARKETING_EMAIL_DOMAIN = "updates.blendcalc.food";
export const MARKETING_EMAIL_FROM = `blendCalc <hello@${MARKETING_EMAIL_DOMAIN}>`;
export const MARKETING_EMAIL_REPLY_TO = "support@blendcalc.food";
export const RESEND_MARKETING_PREFERENCE_URL = "{{{RESEND_UNSUBSCRIBE_URL}}}";
export const MARKETING_EMAIL_POSTAL_ADDRESS_PLACEHOLDER =
	"Business postal address required before sending";

export type MarketingAnnouncementKind = "mvp_testing" | "public_launch";

type MarketingAnnouncementDefinition = {
	name: string;
	subject: string;
	previewText: string;
	title: string;
	body: string;
	callToAction: string;
	secondaryCopy: string;
	topicKey: MarketingEmailTopicKey;
};

type MarketingAnnouncementRenderInput = {
	appUrl?: string;
	preferenceUrl?: string;
	postalAddress?: string;
};

const ANNOUNCEMENT_DEFINITIONS: Record<
	MarketingAnnouncementKind,
	MarketingAnnouncementDefinition
> = {
	mvp_testing: {
		name: "MVP testing announcement",
		subject: "blendCalc MVP testing is open",
		previewText: "The first testable version of blendCalc is ready.",
		title: "blendCalc is ready for testing.",
		body: "The first testable version of blendCalc is ready. Organize ingredients, build a shopping list, review food information, and create nutrition-aware mixes—all in one workspace.",
		callToAction: "Start testing blendCalc",
		secondaryCopy:
			"Things may still change while we prepare the public release. Your feedback will help determine what gets improved next.",
		topicKey: "mvp_testing_invitations",
	},
	public_launch: {
		name: "Official launch announcement",
		subject: "blendCalc is officially live",
		previewText: "Your food-awareness workspace is ready.",
		title: "Your food-awareness workspace is ready.",
		body: "blendCalc is now live. Save ingredients, organize your fridge and shopping list, understand nutrition and food warnings, and build mixes around your goals and preferences.",
		callToAction: "Open blendCalc",
		secondaryCopy: "Thanks for helping shape the first release.",
		topicKey: "product_and_launch_updates",
	},
};

const getPlainText = (
	definition: MarketingAnnouncementDefinition,
	appUrl: string,
	preferenceUrl: string,
	postalAddress: string,
) => `${definition.title}

${definition.body}

${definition.callToAction}: ${appUrl}

${definition.secondaryCopy}

You are receiving this because you chose this type of optional blendCalc email.
Manage preferences or unsubscribe from all: ${preferenceUrl}

blendCalc · ${postalAddress}`;

const getHtml = (
	definition: MarketingAnnouncementDefinition,
	appUrl: string,
	preferenceUrl: string,
	postalAddress: string,
) => `<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8">
		<meta name="viewport" content="width=device-width, initial-scale=1">
		<title>${escapeEmailHtml(definition.subject)}</title>
	</head>
	<body style="margin:0;background:#f8f8fb;color:#1a1a2e;font-family:Arial,Helvetica,sans-serif;line-height:1.55">
		<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeEmailHtml(definition.previewText)}</div>
		<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f8f8fb">
			<tr>
				<td align="center" style="padding:32px 16px">
					<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#ffffff;border:1px solid #dedee6;border-top:6px solid #57a773;border-radius:20px">
						<tr>
							<td style="padding:32px">
								<p style="margin:0 0 24px;font-size:20px;font-weight:800;letter-spacing:-0.02em;color:#1a1a2e">blendCalc</p>
								<p style="display:inline-block;margin:0 0 10px;padding:4px 10px;background:#e8f5ee;border-radius:999px;font-size:12px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#1a1a2e">Your food awareness workspace</p>
								<h1 style="margin:0 0 20px;font-size:30px;line-height:1.15;letter-spacing:-0.03em;color:#1a1a2e">${escapeEmailHtml(definition.title)}</h1>
								<p style="margin:0 0 24px;font-size:16px;color:#343449">${escapeEmailHtml(definition.body)}</p>
								<table role="presentation" cellspacing="0" cellpadding="0" border="0">
									<tr>
										<td style="background:#57a773;border-radius:999px">
											<a href="${escapeEmailHtml(appUrl)}" style="display:inline-block;padding:13px 22px;color:#11141c;font-size:16px;font-weight:800;text-decoration:none">${escapeEmailHtml(definition.callToAction)}</a>
										</td>
									</tr>
								</table>
								<p style="margin:24px 0 0;font-size:14px;color:#70758d">${escapeEmailHtml(definition.secondaryCopy)}</p>
							</td>
						</tr>
						<tr>
							<td style="padding:20px 32px;border-top:1px solid #e9e9ed;font-size:12px;color:#70758d">
								<p style="margin:0 0 8px">You are receiving this because you chose this type of optional blendCalc email.</p>
								<p style="margin:0 0 8px"><a href="${escapeEmailHtml(preferenceUrl)}" style="color:#347b99">Manage preferences</a> · <a href="${escapeEmailHtml(preferenceUrl)}" style="color:#347b99">Unsubscribe from all</a></p>
								<p style="margin:0">blendCalc · ${escapeEmailHtml(postalAddress)}</p>
							</td>
						</tr>
					</table>
				</td>
			</tr>
		</table>
	</body>
</html>`;

export const getMarketingAnnouncementDraft = (
	kind: MarketingAnnouncementKind,
	{
		appUrl = "https://blendcalc.food",
		preferenceUrl = RESEND_MARKETING_PREFERENCE_URL,
		postalAddress = MARKETING_EMAIL_POSTAL_ADDRESS_PLACEHOLDER,
	}: MarketingAnnouncementRenderInput = {},
) => {
	const definition = ANNOUNCEMENT_DEFINITIONS[kind];
	return {
		status: "draft" as const,
		readyToSend: false as const,
		name: definition.name,
		from: MARKETING_EMAIL_FROM,
		replyTo: MARKETING_EMAIL_REPLY_TO,
		topicKey: definition.topicKey,
		subject: definition.subject,
		previewText: definition.previewText,
		text: getPlainText(definition, appUrl, preferenceUrl, postalAddress),
		html: getHtml(definition, appUrl, preferenceUrl, postalAddress),
	};
};
