import { expect, test, waitForAppReady } from "./support/browserTest";

test.use({ storageState: { cookies: [], origins: [] } });

test("the signed-out root exposes the complete public search contract", async ({
	page,
}) => {
	const response = await page.goto("/?campaign=ignored#intro");

	expect(response?.status()).toBe(200);
	await waitForAppReady(page);
	await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
		"content",
		"index,follow,max-image-preview:large",
	);
	await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
		"href",
		"https://www.blendcalc.food/",
	);
	await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
		"content",
		"https://www.blendcalc.food/",
	);
	const organizationText = await page
		.locator('script[data-search-identity="organization"]')
		.textContent();
	expect(organizationText).not.toBeNull();
	const organization = JSON.parse(organizationText!);
	expect(organization).toEqual({
		"@context": "https://schema.org",
		"@type": "Organization",
		name: "blendCalc",
		url: "https://www.blendcalc.food",
	});
});

test("private, API, auth, and missing surfaces fail closed", async ({
	page,
}) => {
	const protectedResponse = await page.request.get("/ingredients/fridge", {
		maxRedirects: 0,
	});
	expect(protectedResponse.status()).toBe(303);
	expect(protectedResponse.headers()["x-robots-tag"]).toBe("noindex, nofollow");

	const apiResponse = await page.request.get("/api/v1/categories");
	expect(apiResponse.headers()["x-robots-tag"]).toBe("noindex, nofollow");

	const authResponse = await page.request.get("/auth");
	expect(authResponse.headers()["x-robots-tag"]).toBe("noindex, nofollow");
	expect(await authResponse.text()).toMatch(
		/<meta name="robots" content="noindex,nofollow"\s*\/?>/,
	);

	const missingResponse = await page.request.get(
		"/missing-search-document.xml",
	);
	expect(missingResponse.status()).toBe(404);
	expect(missingResponse.headers()["x-robots-tag"]).toBe("noindex, nofollow");
	const missingDocument = await missingResponse.text();
	expect(missingDocument).toMatch(
		/<meta name="robots" content="noindex,nofollow"\s*\/?>/,
	);
	expect(missingDocument).not.toMatch(/<link rel="canonical"/);
});

test("robots and sitemap expose only the intended public route", async ({
	page,
}) => {
	const robotsResponse = await page.request.get("/robots.txt");
	expect(robotsResponse.status()).toBe(200);
	expect(robotsResponse.headers()["content-type"]).toContain("text/plain");
	expect(await robotsResponse.text()).toBe(
		"User-agent: *\nAllow: /\nSitemap: https://www.blendcalc.food/sitemap.xml\n",
	);

	const sitemapResponse = await page.request.get("/sitemap.xml");
	expect(sitemapResponse.status()).toBe(200);
	expect(sitemapResponse.headers()["content-type"]).toContain(
		"application/xml",
	);
	const sitemap = await sitemapResponse.text();
	expect(sitemap.match(/<url>/g)).toHaveLength(1);
	expect(sitemap).toContain("<loc>https://www.blendcalc.food/</loc>");
});
