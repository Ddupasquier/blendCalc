import { PUBLIC_SITEMAP_XML } from "$lib/config/searchDiscovery";

export const GET = () =>
	new Response(PUBLIC_SITEMAP_XML, {
		headers: {
			"cache-control": "public, max-age=3600",
			"content-type": "application/xml; charset=utf-8",
		},
	});
