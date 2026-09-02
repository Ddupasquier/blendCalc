import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260826120000_owner_scoped_profile_updates.sql",
	"utf8",
);
const contractMigration = readFileSync(
	"supabase/migrations/20260901100000_enforce_profile_bio_limit.sql",
	"utf8",
);
const databaseTypes = readFileSync("src/lib/types/database.types.ts", "utf8");
const schemaDocumentation = readFileSync(
	"docs/development/supabase-schema.md",
	"utf8",
);

describe("owner-scoped profile updates migration", () => {
	it("derives ownership from the authenticated database identity", () => {
		expect(migration).toContain("v_user_id uuid := auth.uid()");
		expect(migration).toContain("security definer");
		expect(migration).toContain("set search_path = ''");
		expect(migration).not.toContain("p_user_id uuid");
	});

	it("exposes only narrow profile responsibilities to authenticated accounts", () => {
		for (const functionName of [
			"save_current_user_profile_details",
			"save_current_user_appearance_theme",
			"save_current_user_playful_message_preference",
			"save_current_user_profile_image",
			"save_current_user_profile_image_description",
			"clear_current_user_profile_image",
		]) {
			expect(migration).toContain(
				`grant execute on function public.${functionName}`,
			);
			expect(databaseTypes).toContain(functionName);
			expect(schemaDocumentation).toContain(`\`${functionName}\``);
		}
	});

	it("does not tighten the rollout-safe database bio constraint early", () => {
		expect(migration).not.toContain("drop constraint profiles_bio_check");
		expect(migration).not.toContain("char_length(bio) <= 150");
		expect(migration).toContain("char_length(v_bio) > 150");
	});

	it("closes the compatibility window after the 150-character app release", () => {
		expect(contractMigration).toContain("char_length(bio) > 150");
		expect(contractMigration).toContain("left(bio, 150)");
		expect(contractMigration).toContain(
			"drop constraint if exists profiles_bio_check",
		);
		expect(contractMigration).toContain("char_length(bio) <= 150");
	});
});
