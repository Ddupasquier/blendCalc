import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const errorRoute = readFileSync("src/routes/+error.svelte", "utf8");
const hooks = readFileSync("src/hooks.server.ts", "utf8");

describe("native application error handling", () => {
	it("never renders raw SvelteKit error messages", () => {
		expect(errorRoute).not.toContain("page.error?.message");
		expect(errorRoute).not.toContain("page.error.message");
		expect(errorRoute).toContain("getAppIssueMessage");
		expect(errorRoute).toContain("getDefaultAppIssueCode");
	});

	it("uses the reusable current-UI error component", () => {
		expect(errorRoute).toContain("<AppError");
		expect(hooks).toContain("export const handleError");
		expect(hooks).toContain('createAppIssuePayload("UNEXPECTED_ERROR")');
	});
});
