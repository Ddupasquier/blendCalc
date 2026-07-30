import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const routeExists = (path: string) =>
	existsSync(resolve(process.cwd(), `src/routes/${path}`));

describe("URL-backed overlay routes", () => {
	it("defines explicit Mix overlay routes without a catch-all", () => {
		const expectedRoutes = [
			"mix/save/+page.svelte",
			"mix/reset-goals/+page.svelte",
			"mix/clear-ingredients/+page.svelte",
			"mix/reset-all/+page.svelte",
			"mix/rename/fridge/[foodId=signedInteger]/+page.svelte",
			"mix/rename/shopping/[foodId=signedInteger]/+page.svelte",
			"mix/warnings/[warningId]/+page.svelte",
			"mix/ingredients/[foodId=signedInteger]/conversion-details/+page.svelte",
		];

		for (const route of expectedRoutes) {
			expect(routeExists(route), route).toBe(true);
		}
		expect(routeExists("mix/[...slug]")).toBe(false);
	});

	it("shares server data through parent layout loaders", () => {
		expect(routeExists("ingredients/+layout.server.ts")).toBe(true);
		expect(routeExists("mix/+layout.server.ts")).toBe(true);
		expect(routeExists("saved/+layout.server.ts")).toBe(true);
		expect(routeExists("saved/sort/+page.server.ts")).toBe(false);
	});
});
