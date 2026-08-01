import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260731169000_moderator_data_health_dashboard.sql",
	"utf8",
);

describe("moderator data-health migration", () => {
	it("creates one bounded aggregate read", () => {
		expect(migration).toContain("public.get_moderator_data_health(");
		expect(migration).toContain("least(greatest(coalesce(p_days, 30), 1), 90)");
		expect(migration).toContain("least(greatest(coalesce(p_issue_limit, 20), 1), 50)");
	});

	it("checks the caller's database role", () => {
		expect(migration).toContain("role_assignment.user_id = auth.uid()");
		expect(migration).toContain("role_assignment.role in ('moderator', 'admin')");
		expect(migration).toContain("to authenticated;");
		expect(migration).not.toContain("grant execute on function public.get_moderator_data_health(integer, integer)\n\tto anon");
	});

	it("returns summaries without raw or private evidence", () => {
		expect(migration).toContain("'overview', v_overview");
		expect(migration).toContain("'sources', v_sources");
		expect(migration).toContain("'datasets', v_datasets");
		expect(migration).toContain("'policy', v_policy");
		expect(migration).toContain("'issues', v_issues");
		expect(migration).not.toContain("raw_payload");
		expect(migration).not.toContain("evidence_path");
		expect(migration).not.toContain("reported_by");
	});
});
