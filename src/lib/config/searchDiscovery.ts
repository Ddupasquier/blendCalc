import { APP_NAME, APP_PRODUCTION_ORIGIN } from "$lib/config/brand";

export const PUBLIC_INDEXABLE_PATHS = ["/"] as const;

const publicIndexablePathSet = new Set<string>(PUBLIC_INDEXABLE_PATHS);
const SEARCH_CONTROL_PATHS = new Set(["/robots.txt", "/sitemap.xml"]);

export const isIndexablePublicPath = (pathname: string) =>
	publicIndexablePathSet.has(pathname);

export const getSearchRobotsDirective = (pathname: string, status = 200) =>
	status < 400 && isIndexablePublicPath(pathname)
		? "index,follow,max-image-preview:large"
		: "noindex,nofollow";

export const shouldSendNoIndexHeader = (pathname: string, status: number) =>
	!SEARCH_CONTROL_PATHS.has(pathname) &&
	(status >= 400 || !isIndexablePublicPath(pathname));

export const PUBLIC_SITEMAP_URLS = PUBLIC_INDEXABLE_PATHS.map(
	(pathname) => `${APP_PRODUCTION_ORIGIN}${pathname}`,
);

const escapeXmlText = (value: string) =>
	value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&apos;");

export const PUBLIC_SITEMAP_XML = [
	'<?xml version="1.0" encoding="UTF-8"?>',
	'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
	...PUBLIC_SITEMAP_URLS.map(
		(url) => `  <url><loc>${escapeXmlText(url)}</loc></url>`,
	),
	"</urlset>",
	"",
].join("\n");

export const PUBLIC_ROBOTS_TXT = [
	"User-agent: *",
	"Allow: /",
	`Sitemap: ${APP_PRODUCTION_ORIGIN}/sitemap.xml`,
	"",
].join("\n");

export const PUBLIC_ORGANIZATION_STRUCTURED_DATA = Object.freeze({
	"@context": "https://schema.org",
	"@type": "Organization",
	name: APP_NAME,
	url: APP_PRODUCTION_ORIGIN,
});

export const PUBLIC_ORGANIZATION_STRUCTURED_DATA_JSON = JSON.stringify(
	PUBLIC_ORGANIZATION_STRUCTURED_DATA,
).replaceAll("<", "\\u003c");
