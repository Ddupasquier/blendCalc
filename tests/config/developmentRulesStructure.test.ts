import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const rulesPath = "docs/development/dev-rules/dev-rules.md";
const auditPath = "docs/development/dev-rules/dev-rules-audit.md";
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
		expect(audit).toMatch(
			/An audit finding never\s+overrides a (?:settled )?rule\./,
		);
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
		expect(rules).toContain(
			"never approve\nall current or future scripts through a wildcard",
		);
	});

	it("requires status-first Project triage and delivery-class ownership", () => {
		expect(rules).toContain("##### Required Project Management Flow");
		for (const requirement of [
			"Triage Inbox before pickup",
			"Move the ticket before doing the work",
			"Classify before approval handling",
			"Deliver according to ownership",
			"Reconcile before selecting the next ticket",
			"Correct lifecycle mistakes before continuing",
		]) {
			expect(rules).toContain(requirement);
		}
		expect(rules).toContain(
			"Never leave actively worked content in\n   `Inbox`, `Ready`, or an unrelated lifecycle state",
		);
		expect(rules).toContain(
			"Verification-only work already proven on `main`\n   goes directly to `Done`",
		);
	});

	it("defines a fast owner command lifecycle without weakening release gates", () => {
		expect(rules).toContain("Owner command fast lane:");
		expect(rules).toContain("**`Go`**");
		expect(rules).toContain("**`Ship`**");
		expect(rules).toContain("`ship-ready-batch`");
		expect(rules).toContain(
			"Run at most one complete hosted\nbrowser matrix for each unique release tree",
		);
		expect(rules).toContain(
			"A mandatory schema-first database\nexpansion and its dependent application remain separate release trees",
		);
		expect(rules).not.toContain("proposed-commit ledger");
	});

	it("keeps every individual rule available in the document outline", () => {
		const outlinedRuleCount = [
			...rules.matchAll(
				/<a id="rule-[^"]+"><\/a>\n\n#### Rule [0-9]+[a-z]*(?:\.[0-9]+[a-z]?)? — .+/g,
			),
		].length;
		const ruleHeadingCount = [
			...rules.matchAll(/^#### Rule [0-9]+[a-z]*(?:\.[0-9]+[a-z]?)? — .+$/gm),
		].length;

		expect(rules).toContain("## Rule Finder");
		expect(ruleHeadingCount).toBeGreaterThan(100);
		expect(outlinedRuleCount).toBe(ruleHeadingCount);
		expect(rules).not.toMatch(
			/<a id="rule-[^"]+"><\/a>\n\n\*\*[0-9]+[a-z]*(?:\.[0-9]+[a-z]?)?\.\*\*/,
		);
	});
});
