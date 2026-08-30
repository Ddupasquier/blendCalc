import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	resolve("supabase/migrations/20260829092000_blendcalc_api_keys.sql"),
	"utf8",
);
const optionalExpiryMigration = readFileSync(
	resolve(
		"supabase/migrations/20260830142000_optional_blendcalc_api_key_expiry.sql",
	),
	"utf8",
);

describe("blendCalcAPI key schema", () => {
	it("stores hashes and lifecycle metadata without plaintext secrets", () => {
		expect(migration).toContain("create table public.blendcalc_api_keys");
		expect(migration).toContain("key_hash text not null unique");
		expect(migration).toContain("key_prefix text not null");
		expect(migration).toContain("last_used_at timestamptz");
		expect(migration).toContain("expires_at timestamptz");
		expect(migration).toContain("revoked_at timestamptz");
		expect(migration).not.toMatch(/plaintext|raw_key|secret text/);
	});

	it("keeps key rows service-only and rotates them atomically", () => {
		expect(migration).toContain("force row level security");
		expect(migration).toContain(
			"create function public.rotate_blendcalc_api_key",
		);
		expect(migration).toContain("for update");
		expect(migration).toContain("revocation_reason = 'rotated'");
		expect(migration).not.toContain(
			"grant select on table public.blendcalc_api_keys to authenticated",
		);
	});

	it("allows a rotated key to omit an expiry without inventing a date", () => {
		expect(optionalExpiryMigration).toContain(
			"p_expires_at timestamptz default null",
		);
		expect(optionalExpiryMigration).toContain("p_created_by uuid default null");
		expect(optionalExpiryMigration).toContain(
			"p_scopes, p_expires_at, v_current.id, p_created_by",
		);
	});
});
