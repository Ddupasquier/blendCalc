import { describe, expect, it } from "vitest";
import { createRehearsalSourcePsqlInvocation } from "../../scripts/lib/rehearsal/postgres_client.mjs";

describe("Rehearsal PostgreSQL client", () => {
	it("uses a disposable pinned client image without putting credentials in arguments", () => {
		const password = "not-in-process-arguments";
		const invocation = createRehearsalSourcePsqlInvocation({
			databaseUrl: new URL(
				"postgresql://unused@pooler.example.test:5432/postgres?sslmode=require",
			),
			connectionUsername: "rehearsal_source.projectref",
			password,
			database: "postgres",
		});

		expect(invocation.command).toBe("docker");
		expect(invocation.args).toContain("postgres:17-alpine");
		expect(invocation.args).toContain("psql");
		expect(invocation.args.join(" ")).not.toContain(password);
		expect(invocation.environment.PGPASSWORD).toBe(password);
		expect(invocation.environment.PGUSER).toBe("rehearsal_source.projectref");
	});
});
