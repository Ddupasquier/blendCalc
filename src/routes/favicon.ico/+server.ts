import faviconSvg from "$lib/assets/favicon.svg?raw";

export const GET = () =>
	new Response(faviconSvg, {
		headers: {
			"cache-control": "public, max-age=86400",
			"content-type": "image/svg+xml; charset=utf-8",
		},
	});
