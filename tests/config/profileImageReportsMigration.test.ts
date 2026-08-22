import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	resolve("supabase/migrations/20260822110000_report_driven_profile_image_moderation.sql"),
	"utf8",
);
const databaseTypes = readFileSync(resolve("src/lib/types/database.types.ts"), "utf8");
const schemaDocumentation = readFileSync(resolve("docs/supabase-schema.md"), "utf8");

describe("report-driven profile image moderation migration", () => {
	it("stores reports against the exact current profile image", () => {
		expect(migration).toContain("create table public.profile_image_reports");
		expect(migration).toContain("avatar_path text not null");
		expect(migration).toContain("Profile image report must reference the current profile image.");
		expect(migration).toContain("unique (reported_by, reported_profile_user_id, avatar_path)");
	});

	it("prevents self-reports and requires a reviewer for final decisions", () => {
		expect(migration).toContain("check (reported_by <> reported_profile_user_id)");
		expect(migration).toContain("status in ('dismissed', 'removed')");
		expect(migration).toContain("reviewed_by is not null and reviewed_at is not null");
	});

	it("supersedes reports when the user replaces the reported image", () => {
		expect(migration).toContain("supersede_replaced_profile_image_reports");
		expect(migration).toContain("old.avatar_path is distinct from new.avatar_path");
		expect(migration).toContain("status = 'superseded'");
	});

	it("keeps report reads and writes behind the trusted server boundary", () => {
		expect(migration).toContain("force row level security");
		expect(migration).toContain(
			"revoke all on table public.profile_image_reports from anon, authenticated",
		);
		expect(migration).toContain(
			"grant all on table public.profile_image_reports to service_role",
		);
		expect(migration).not.toContain("create policy");
	});

	it("keeps the grouped queue count and maintained schema artifacts synchronized", () => {
		expect(migration).toContain("get_pending_profile_image_review_count");
		expect(databaseTypes).toContain("profile_image_reports");
		expect(databaseTypes).toContain("get_pending_profile_image_review_count");
		expect(schemaDocumentation).toContain("`profile_image_reports`");
	});
});
