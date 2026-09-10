import { describe, expect, it } from "vitest";
import {
	getMarketingAnnouncementDraft,
	MARKETING_EMAIL_FROM,
	MARKETING_EMAIL_POSTAL_ADDRESS_PLACEHOLDER,
	MARKETING_EMAIL_REPLY_TO,
	RESEND_MARKETING_PREFERENCE_URL,
} from "$lib/server/email/marketingAnnouncementEmail.server";

describe("marketing announcement email drafts", () => {
	it.each([
		["mvp_testing" as const, "blendCalc MVP testing is open"],
		["public_launch" as const, "blendCalc is officially live"],
	])("renders the %s draft without enabling delivery", (kind, subject) => {
		const draft = getMarketingAnnouncementDraft(kind);

		expect(draft).toMatchObject({
			status: "draft",
			readyToSend: false,
			from: MARKETING_EMAIL_FROM,
			replyTo: MARKETING_EMAIL_REPLY_TO,
			subject,
		});
		expect(draft.html).toContain(draft.previewText);
		expect(draft.html).toContain(RESEND_MARKETING_PREFERENCE_URL);
		expect(draft.html).toContain(MARKETING_EMAIL_POSTAL_ADDRESS_PLACEHOLDER);
		expect(draft.text).toContain("Manage preferences or unsubscribe from all");
		expect(draft.html).not.toMatch(/<(?:script|img)\b/i);
	});

	it("escapes every caller-provided field in HTML", () => {
		const draft = getMarketingAnnouncementDraft("public_launch", {
			appUrl: 'https://blendcalc.food/?value=<script>alert("x")</script>',
			preferenceUrl: "https://blendcalc.food/preferences?a=1&b=2",
			postalAddress: "1 <Main> & Company",
		});

		expect(draft.html).not.toContain("<script>");
		expect(draft.html).toContain("&lt;script&gt;");
		expect(draft.html).toContain("a=1&amp;b=2");
		expect(draft.html).toContain("1 &lt;Main&gt; &amp; Company");
	});
});
