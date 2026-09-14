import { describe, expect, it } from "vitest";
import {
	REHEARSAL_EXIT_CODES,
	RehearsalError,
	createRehearsalResult,
	redactDiagnosticValue,
	renderHumanError,
	serializeRehearsalError,
} from "../../scripts/lib/rehearsal/diagnostics.mjs";

const canaries = {
	password: "never-print-this-password",
	serviceRoleKey: "sb_secret_never-print-this-key",
	databaseUrl: "postgresql://admin:secret@hosted.example/database",
	authorization: "Bearer secret-token",
	nested: { jwt: "eyJabcdefghijk.abcdefghijkl.abcdefghijkl" },
};

describe("Rehearsal diagnostics", () => {
	it("publishes stable exit categories", () => {
		expect(REHEARSAL_EXIT_CODES).toEqual({
			success: 0,
			configuration_invalid: 2,
			unsafe_environment: 3,
			baseline_invalid: 4,
			baseline_checksum_mismatch: 5,
			migration_candidate_failure: 6,
			migration_verification_failure: 7,
			application_proof_failure: 8,
			runtime_dependency_failure: 9,
			internal_failure: 10,
		});
	});

	it("serializes every public failure category with its stable exit code", () => {
		for (const [category, exitCode] of Object.entries(REHEARSAL_EXIT_CODES)) {
			if (category === "success") continue;
			const error = new RehearsalError({
				category,
				code: `TEST_${category.toUpperCase()}`,
				message: `Synthetic ${category}`,
				expected: "safe expected state",
				actual: "safe actual state",
				refused: "Synthetic action refused.",
			});
			const serialized = serializeRehearsalError(error);
			expect(error.exitCode).toBe(exitCode);
			expect(serialized.error.category).toBe(category);
			expect(serialized.error.code).toBe(`TEST_${category.toUpperCase()}`);
		}
	});

	it("redacts credentials, connection strings, tokens, and JWTs recursively", () => {
		const result = JSON.stringify(redactDiagnosticValue(canaries));
		for (const canary of [
			"never-print-this-password",
			"sb_secret_never-print-this-key",
			"admin:secret",
			"secret-token",
			"eyJabcdefghijk",
		]) {
			expect(result).not.toContain(canary);
		}
	});

	it("uses one safe model for human and JSON failures", () => {
		const error = new RehearsalError({
			category: "unsafe_environment",
			code: "HOSTED_TARGET",
			message: `Refused ${canaries.databaseUrl}`,
			expected: "loopback",
			actual: canaries,
			refused: "Database restore was not started.",
			suggestions: ["Use an isolated local Supabase config."],
		});
		expect(error.exitCode).toBe(3);
		for (const debug of [false, true]) {
			const json = JSON.stringify(serializeRehearsalError(error, { debug }));
			const human = renderHumanError(error, { debug });
			expect(json).toContain("HOSTED_TARGET");
			expect(human).toContain("Database restore was not started");
			for (const canary of [
				"admin:secret",
				"never-print-this-password",
				"sb_secret_never-print-this-key",
				"secret-token",
				"eyJabcdefghijk",
			]) {
				expect(`${json}${human}`).not.toContain(canary);
			}
		}
	});

	it("wraps successful machine output in a versioned envelope", () => {
		const result = createRehearsalResult({
			command: "doctor",
			status: "success",
			data: { state: "READY", credentials: canaries },
		});
		expect(result.schemaVersion).toBe(1);
		expect(result.rehearsalVersion).toBe("0.1.0-beta.0");
		expect(result.data.state).toBe("READY");
		expect(JSON.stringify(result)).not.toContain("never-print-this-password");
	});

	it("retains non-secret safety metadata while redacting its nested values", () => {
		const result = createRehearsalResult({
			command: "doctor",
			status: "success",
			data: {
				ambientHostedVariables: {
					presentButQuarantined: ["SUPABASE_ACCESS_TOKEN"],
					note: "not inherited",
				},
			},
		});
		expect(result.data.ambientHostedVariables).toEqual({
			presentButQuarantined: ["SUPABASE_ACCESS_TOKEN"],
			note: "not inherited",
		});
	});
});
