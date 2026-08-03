import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Mix persistence architecture", () => {
	it("restores authoritative cloud preferences even when a saved-mix marker survives", () => {
		const page = readFileSync("src/routes/mix/+page.svelte", "utf8");
		const mountBlock = page.slice(
			page.indexOf("onMount(() =>"),
			page.indexOf("$effect(() =>", page.indexOf("onMount(() =>")),
		);

		expect(mountBlock).toContain("loadCloudBackedMixPreferences();");
		expect(mountBlock).not.toContain(
			"if (!restoredSavedDrink) loadCloudBackedMixPreferences();",
		);
	});
});
