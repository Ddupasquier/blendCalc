import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	resolve("supabase/migrations/20260810120000_catalog_submission_enforcement.sql"),
	"utf8",
);

describe("catalog submission enforcement migration", () => {
	it("stores current enforcement separately from immutable block events", () => {
		expect(migration).toContain("create table public.user_catalog_submission_enforcement");
		expect(migration).toContain("moderator_rejection_count");
		expect(migration).toContain("sharing_suspended_until");
		expect(migration).toContain("insert into public.product_submission_blocks");
	});

	it("starts a six-month suspension only after more than fifty moderator rejections", () => {
		expect(migration).toContain("moderator_rejection_count > 50");
		expect(migration).toContain("interval '6 months'");
		expect(migration).toContain("new.status = 'rejected'");
		expect(migration).not.toContain("new.status = 'auto_declined'");
	});

	it("maintains the count atomically when moderation changes submission status", () => {
		expect(migration).toContain("on conflict (user_id) do update");
		expect(migration).toContain(
			"public.user_catalog_submission_enforcement.moderator_rejection_count + 1",
		);
		expect(migration).toContain("after update of status on public.shared_product_submissions");
	});

	it("keeps ordinary clients read-only and scoped to their own enforcement row", () => {
		expect(migration).toContain("user_id = (select auth.uid())");
		expect(migration).toContain(
			"revoke all on table public.user_catalog_submission_enforcement",
		);
		expect(migration).toContain(
			"grant select on table public.user_catalog_submission_enforcement to authenticated",
		);
	});
});
