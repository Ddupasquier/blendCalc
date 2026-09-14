import { describe, expect, it } from "vitest";
import {
	assertProofIdentifier,
	buildClusterSetupSql,
	buildDatabaseSetupSql,
	buildCleanupSql,
	createProofIdentifiers,
} from "../../scripts/lib/rehearsal/export_authorization_boundary.mjs";

describe("Rehearsal export authorization boundary", () => {
	it("creates bounded disposable identifiers and rejects caller-controlled SQL", () => {
		expect(createProofIdentifiers("0123456789")).toEqual({
			database: "rehearsal_boundary_0123456789",
			ownerRole: "rehearsal_owner_0123456789",
			readerRole: "rehearsal_reader_0123456789",
			loginRole: "rehearsal_login_0123456789",
		});
		expect(() => createProofIdentifiers("not-safe")).toThrow(
			"ten lowercase hex characters",
		);
		expect(() =>
			assertProofIdentifier("unsafe; drop database postgres"),
		).toThrow("Unsafe Rehearsal proof identifier");
	});

	it("keeps the login, reader, and view owner capabilities separate", () => {
		const identifiers = createProofIdentifiers("0123456789");
		const clusterSql = buildClusterSetupSql(identifiers, "synthetic-password");
		const databaseSql = buildDatabaseSetupSql(identifiers);

		expect(clusterSql).toContain("nologin nosuperuser nocreatedb nocreaterole");
		expect(clusterSql).toContain("with inherit true, set false");
		expect(clusterSql).toContain("set default_transaction_read_only = on");
		expect(clusterSql).toContain("revoke all on database");
		expect(databaseSql).toContain("force row level security");
		expect(databaseSql).toContain("revoke all on schema public from public");
		expect(databaseSql).toContain("revoke usage on schema net from public");
		expect(databaseSql).toContain("security_barrier = true");
		expect(databaseSql).toContain("security_invoker = false");
		expect(databaseSql).toContain("to postgres with inherit false, set true");
		expect(databaseSql).toContain(
			'revoke "rehearsal_owner_0123456789" from postgres',
		);
		expect(databaseSql).toContain(
			"grant select on rehearsal_export.proof_records_v1",
		);
		expect(databaseSql).not.toMatch(/select\s+\*/iu);
	});

	it("removes only its exact disposable database and roles", () => {
		const identifiers = createProofIdentifiers("0123456789");
		const cleanupSql = buildCleanupSql(identifiers);

		expect(cleanupSql).toContain(
			'drop database if exists "rehearsal_boundary_0123456789" with (force)',
		);
		expect(cleanupSql).toContain(
			'drop role if exists "rehearsal_login_0123456789"',
		);
		expect(cleanupSql).not.toContain("drop owned");
	});
});
