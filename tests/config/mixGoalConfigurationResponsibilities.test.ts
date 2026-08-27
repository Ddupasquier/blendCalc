import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const mixPageSource = readFileSync("src/routes/mix/+page.svelte", "utf8");
const goalControllerSource = readFileSync(
	"src/lib/utils/mix/state/mixGoalConfigurationController.svelte.ts",
	"utf8",
);

describe("Mix goal configuration responsibilities", () => {
	it("keeps goal persistence and template lifecycle outside the Mix route", () => {
		expect(mixPageSource).toContain("createMixGoalConfigurationController");
		expect(mixPageSource).not.toContain("saveCloudMixGoalConfiguration");
		expect(mixPageSource).not.toContain("saveCloudUserMixGoalTemplate");
		expect(mixPageSource).not.toContain("deleteCloudUserMixGoalTemplate");

		expect(goalControllerSource).toContain("saveCloudMixGoalConfiguration");
		expect(goalControllerSource).toContain("saveCloudUserMixGoalTemplate");
		expect(goalControllerSource).toContain("deleteCloudUserMixGoalTemplate");
	});
});
