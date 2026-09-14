import { describe, expect, it } from "vitest";
import {
	assertProductionSchemaDump,
	compareProductionSchemaDumps,
} from "../../scripts/lib/rehearsal/schema_snapshot.mjs";

describe("Rehearsal production schema snapshot", () => {
	it("accepts a bounded schema-only public dump", () => {
		expect(
			assertProductionSchemaDump(
				'SET row_security = off;\nCREATE SCHEMA IF NOT EXISTS "public";\nCREATE TABLE public.example(id bigint);\n',
			),
		).toContain("CREATE TABLE");
	});

	it("rejects empty, data-bearing, and database-switching dumps", () => {
		for (const source of [
			"",
			'CREATE SCHEMA IF NOT EXISTS "public";\nCOPY public.example FROM stdin;\n',
			'CREATE SCHEMA IF NOT EXISTS "public";\n\\connect elsewhere\n',
			'CREATE SCHEMA IF NOT EXISTS "public";\nCREATE DATABASE unsafe;\n',
		]) {
			expect(() => assertProductionSchemaDump(source)).toThrow();
		}
	});

	it("accepts database-normalized check expressions but no structural drift", () => {
		const expected = `CREATE SCHEMA IF NOT EXISTS "public";
CREATE TABLE public.example (
    CONSTRAINT "example_value_check" CHECK (((value > 0) AND (value < 10)))
);`;
		const normalized = `CREATE SCHEMA IF NOT EXISTS "public";

CREATE TABLE public.example (
    CONSTRAINT "example_value_check" CHECK ((value > 0 AND value < 10))
);`;
		expect(
			compareProductionSchemaDumps({ expected, actual: normalized }),
		).toMatch(/^[a-f0-9]{64}$/u);
		expect(() =>
			compareProductionSchemaDumps({
				expected,
				actual: normalized.replace("public.example", "public.other"),
			}),
		).toThrow("does not structurally match");
	});
});
