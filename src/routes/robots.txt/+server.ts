import { PUBLIC_ROBOTS_TXT } from "$lib/config/searchDiscovery";

export const GET = () =>
	new Response(PUBLIC_ROBOTS_TXT, {
		headers: {
			"cache-control": "public, max-age=3600",
			"content-type": "text/plain; charset=utf-8",
		},
	});
