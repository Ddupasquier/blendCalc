import { dev } from "$app/environment";
import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
	getMarketingAnnouncementDraft,
	type MarketingAnnouncementKind,
} from "$lib/server/email/marketingAnnouncementEmail.server";

const PREVIEW_KINDS: Record<string, MarketingAnnouncementKind> = {
	"mvp-testing": "mvp_testing",
	"public-launch": "public_launch",
};

const isLocalHostname = (hostname: string) =>
	hostname === "localhost" || hostname === "127.0.0.1";

export const GET: RequestHandler = ({ params, url }) => {
	if (!dev && !isLocalHostname(url.hostname)) throw error(404, "Not found");
	const kind = PREVIEW_KINDS[params.kind];
	if (!kind) throw error(404, "Unknown email preview");

	const draft = getMarketingAnnouncementDraft(kind);
	return new Response(draft.html, {
		headers: {
			"Content-Type": "text/html; charset=utf-8",
			"Cache-Control": "no-store",
			"X-Robots-Tag": "noindex, nofollow",
		},
	});
};
