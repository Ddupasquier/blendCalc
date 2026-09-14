import { describe, expect, it } from "vitest";
import { parseRehearsalSourceDatabaseUrl } from "../../scripts/lib/rehearsal/source_connection.mjs";

describe("Rehearsal source database connection", () => {
	it("keeps a direct dedicated login and observed role identical", () => {
		const parsed = parseRehearsalSourceDatabaseUrl(
			"postgresql://rehearsal_source:secret@db.example.test:5432/postgres?sslmode=require",
		);

		expect(parsed.connectionUsername).toBe("rehearsal_source");
		expect(parsed.databaseRole).toBe("rehearsal_source");
		expect(parsed.poolerProjectReference).toBeUndefined();
		expect(parsed.database).toBe("postgres");
	});

	it("separates a Supabase pooler suffix from the observed database role", () => {
		const parsed = parseRehearsalSourceDatabaseUrl(
			"postgresql://rehearsal_source.abcdefghijklmnopqrst:secret@aws-1-us-west-2.pooler.supabase.com:5432/postgres?sslmode=require",
		);

		expect(parsed.connectionUsername).toBe(
			"rehearsal_source.abcdefghijklmnopqrst",
		);
		expect(parsed.databaseRole).toBe("rehearsal_source");
		expect(parsed.poolerProjectReference).toBe("abcdefghijklmnopqrst");
	});

	it.each([
		"https://rehearsal_source:secret@example.test/postgres",
		"postgresql://postgres:secret@example.test/postgres",
		"postgresql://rehearsal_source.short:secret@example.test/postgres",
		"postgresql://rehearsal_source.project.extra:secret@example.test/postgres",
		"postgresql://rehearsal_source@example.test/postgres",
	])("rejects incomplete or non-dedicated source URLs: %s", (value) => {
		expect(() => parseRehearsalSourceDatabaseUrl(value)).toThrow();
	});
});
