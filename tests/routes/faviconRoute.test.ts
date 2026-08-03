import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { GET } from "../../src/routes/favicon.ico/+server";

describe("favicon route", () => {
	it("serves the blendCalc icon for conventional browser requests", async () => {
		const response = GET();
		const body = await response.text();

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("image/svg+xml");
		expect(body).toContain("<title>blendCalc</title>");
		expect(body).not.toContain("svelte-logo");
	});

	it("uses the blendCalc favicon for browser tabs", () => {
		const layout = readFileSync("src/routes/+layout.svelte", "utf8");

		expect(layout).not.toContain('import favicon from "$lib/assets/favicon.svg";');
		expect(layout).toContain(
			'<link rel="icon" type="image/svg+xml" sizes="any" href="/favicon.ico" />',
		);
		expect(layout).toContain('<link rel="shortcut icon" href="/favicon.ico" />');
	});
});
