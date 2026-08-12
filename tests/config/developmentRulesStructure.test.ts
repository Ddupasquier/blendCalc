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
		expect(audit).toContain("[development rules](dev-rules.md)");
		expect(audit).toMatch(/An audit finding never\s+overrides a (?:settled )?rule\./);
	});

	it("keeps completed audit summaries out of the active documents", () => {
		expect(rules).not.toContain("## Audit Summary");
		expect(rules).not.toContain("## Findings");
		expect(audit).not.toContain("## Audit Summary");
		expect(audit).not.toContain("## Removed As Resolved");
	});

	it("requires one outcome-driven lifecycle for every change", () => {
		expect(rules).toContain("## Canonical Change Lifecycle");
		for (const phase of [
			"Establish The Contract",
			"Map The Existing System",
			"Classify Before Coding",
			"Implement One Coherent Slice",
			"Verify Outcomes",
			"Close Out Cleanly",
		]) {
			expect(rules).toContain(phase);
		}
		expect(rules).toContain(
			"Do not treat file splitting,\ntoken use, a shared wrapper, passing string-presence tests, or a successful build as\nproof",
		);
		expect(rules).toMatch(
			/A UI rebuild or visual adjustment is not complete based on compilation\s+and unit tests alone/,
		);
	});

	it("documents accessible reordering and dependency supply-chain boundaries", () => {
		expect(rules).toContain('id="rule-reorderable-collections"');
		expect(rules).toContain("Arrow Up, Arrow Down,\nHome, and End");
		expect(rules).toContain("one polite live region");
		expect(rules).toContain('id="rule-dependency-supply-chain"');
		expect(rules).toContain("version-pinned package scripts");
		expect(rules).toContain("never approve\nall current or future scripts through a wildcard");
	});
});
