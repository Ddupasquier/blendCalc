import { describe, expect, it } from "vitest";
import { APP_NAME, APP_PRODUCTION_ORIGIN } from "$lib/config/brand";
import {
	getSearchRobotsDirective,
	isIndexablePublicPath,
	PUBLIC_INDEXABLE_PATHS,
	PUBLIC_ORGANIZATION_STRUCTURED_DATA,
	PUBLIC_ROBOTS_TXT,
	PUBLIC_SITEMAP_URLS,
	PUBLIC_SITEMAP_XML,
	shouldSendNoIndexHeader,
} from "$lib/config/searchDiscovery";

describe("public search discovery", () => {
	it("keeps one explicit indexable public-route allowlist", () => {
		expect(PUBLIC_INDEXABLE_PATHS).toEqual(["/"]);
		expect(isIndexablePublicPath("/")).toBe(true);
		expect(isIndexablePublicPath("/auth")).toBe(false);
		expect(isIndexablePublicPath("/ingredients/fridge")).toBe(false);
		expect(isIndexablePublicPath("/api/v1/categories")).toBe(false);
		expect(isIndexablePublicPath("/missing-page")).toBe(false);
	});

	it("indexes only successful allowlisted pages and noindexes every other surface", () => {
		expect(getSearchRobotsDirective("/", 200)).toBe(
			"index,follow,max-image-preview:large",
		);
		expect(getSearchRobotsDirective("/auth", 200)).toBe("noindex,nofollow");
		expect(getSearchRobotsDirective("/", 404)).toBe("noindex,nofollow");

		expect(shouldSendNoIndexHeader("/", 200)).toBe(false);
		expect(shouldSendNoIndexHeader("/auth", 200)).toBe(true);
		expect(shouldSendNoIndexHeader("/api/v1/categories", 200)).toBe(true);
		expect(shouldSendNoIndexHeader("/missing-page", 404)).toBe(true);
		expect(shouldSendNoIndexHeader("/robots.txt", 200)).toBe(false);
		expect(shouldSendNoIndexHeader("/sitemap.xml", 200)).toBe(false);
	});

	it("generates a root sitemap from the same absolute canonical allowlist", () => {
		expect(PUBLIC_SITEMAP_URLS).toEqual([`${APP_PRODUCTION_ORIGIN}/`]);
		expect(PUBLIC_SITEMAP_XML).toContain(
			'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
		);
		expect(PUBLIC_SITEMAP_XML).toContain(
			`<loc>${APP_PRODUCTION_ORIGIN}/</loc>`,
		);
		expect(PUBLIC_SITEMAP_XML).not.toMatch(/auth|ingredients|profile|api\/v1/);
	});

	it("names the canonical sitemap without blocking page crawling", () => {
		expect(PUBLIC_ROBOTS_TXT).toBe(
			`User-agent: *\nAllow: /\nSitemap: ${APP_PRODUCTION_ORIGIN}/sitemap.xml\n`,
		);
		expect(PUBLIC_ROBOTS_TXT).not.toContain("Disallow");
	});

	it("keeps organization identity synchronized with visible brand constants", () => {
		expect(PUBLIC_ORGANIZATION_STRUCTURED_DATA).toEqual({
			"@context": "https://schema.org",
			"@type": "Organization",
			name: APP_NAME,
			url: APP_PRODUCTION_ORIGIN,
		});
	});
});
