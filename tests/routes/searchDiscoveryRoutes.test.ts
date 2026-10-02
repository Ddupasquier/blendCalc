import { describe, expect, it } from "vitest";
import { GET as getRobots } from "../../src/routes/robots.txt/+server";
import { GET as getSitemap } from "../../src/routes/sitemap.xml/+server";

describe("public search discovery routes", () => {
	it("serves the root robots contract as plain text", async () => {
		const response = getRobots();

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe(
			"text/plain; charset=utf-8",
		);
		expect(await response.text()).toContain(
			"Sitemap: https://www.blendcalc.food/sitemap.xml",
		);
	});

	it("serves a valid XML sitemap containing only the public canonical root", async () => {
		const response = getSitemap();
		const xml = await response.text();

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe(
			"application/xml; charset=utf-8",
		);
		expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
		expect(xml.match(/<url>/g)).toHaveLength(1);
		expect(xml).toContain("<loc>https://www.blendcalc.food/</loc>");
	});
});
