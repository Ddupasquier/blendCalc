import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const rulesPath = "docs/dev-rules/dev-rules.md";
const auditPath = "docs/dev-rules/dev-rules-audit.md";
const legacyCombinedPath = "docs/development-rules-audit.md";
const rules = readFileSync(rulesPath, "utf8");
const audit = readFileSync(auditPath, "utf8");

describe("development rules documentation", () => {
	it("keeps authoritative rules and mutable audit findings separate", () => {
		expect(existsSync(rulesPath)).toBe(true);
		expect(existsSync(auditPath)).toBe(true);
		expect(existsSync(legacyCombinedPath)).toBe(false);
		expect(rules).toContain("source of truth");
		expect(rules).toContain("dev-rules-audit.md");
		expect(audit).toContain("[the development rules](dev-rules.md)");
		expect(audit).toMatch(/An audit\s+finding never overrides a rule\./);
	});

	it("keeps completed audit summaries out of the active documents", () => {
		expect(rules).not.toContain("## Audit Summary");
		expect(rules).not.toContain("## Findings");
		expect(audit).not.toContain("## Audit Summary");
		expect(audit).not.toContain("## Removed As Resolved");
	});
});
