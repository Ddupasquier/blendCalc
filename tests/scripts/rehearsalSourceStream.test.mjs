import { describe, expect, it } from "vitest";
import {
	assertSourcePreflight,
	buildConsistentExportSql,
	encodeConsistentExportRecord,
	parseConsistentExportLines,
} from "../../scripts/lib/rehearsal/source_stream.mjs";

const manifest = {
	tables: [
		{
			name: "profiles",
			sourceRows: "STREAM AND SANITIZE",
			columns: [
				{ name: "user_id", primaryKey: true },
				{ name: "display_name", primaryKey: false },
			],
		},
		{
			name: "blendcalc_api_keys",
			sourceRows: "EXCLUDE",
			columns: [{ name: "id", primaryKey: true }],
		},
	],
};
const preflight = {
	kind: "preflight",
	database: "synthetic_source",
	role: "rehearsal_export_login",
	transactionReadOnly: true,
	roleSafe: true,
	cannotCreateDatabaseObjects: true,
	exportSchemaVisible: true,
	sourceSchemasHidden: true,
	networkFunctionPathsDenied: true,
	ownerUnreachable: true,
	ownerUserId: "11111111-1111-4111-8111-111111111111",
	ownerEmailSha256: "a".repeat(64),
	migrationHistory: [
		{
			version: "20260911223000",
			name: "privileged_queue_admission",
			statementCount: 29,
			statementSha256: "a".repeat(64),
		},
	],
	views: ["migration_history_v1", "profiles_v1", "source_scope_v1"],
};
const ownerOptions = {
	expectedOwnerUserId: preflight.ownerUserId,
	expectedOwnerEmailSha256: preflight.ownerEmailSha256,
};

describe("Rehearsal consistent source stream", () => {
	it("builds one serializable read-only transaction over explicit ordered views", () => {
		const sql = buildConsistentExportSql({ manifest });

		expect(sql).toContain(
			"begin transaction isolation level serializable read only deferrable",
		);
		expect(sql).toContain("rehearsal_export.source_scope_v1");
		expect(sql).toContain("role_state.rolvaliduntil");
		expect(sql).toContain(
			"has_schema_privilege(current_user, network_schema.oid, 'usage')",
		);
		expect(sql).toContain(
			"has_function_privilege(current_user, network_function.oid, 'execute')",
		);
		expect(sql).not.toContain("network_function.prosecdef");
		expect(sql).toContain('from "rehearsal_export"."profiles_v1"');
		expect(sql).toContain('order by "user_id"');
		expect(sql).not.toContain("blendcalc_api_keys_v1");
		expect(sql.indexOf("'kind', 'preflight'")).toBeLessThan(
			sql.indexOf('"profiles_v1"'),
		);
		expect(sql.indexOf('"profiles_v1"')).toBeLessThan(
			sql.indexOf("'kind', 'complete'"),
		);
	});

	it("requires exact authorization and view-manifest preflight state", () => {
		expect(() =>
			assertSourcePreflight({
				preflight,
				expectedDatabase: "synthetic_source",
				expectedRole: "rehearsal_export_login",
				expectedViews: [
					"migration_history_v1",
					"profiles_v1",
					"source_scope_v1",
				],
				...ownerOptions,
			}),
		).not.toThrow();
		expect(() =>
			assertSourcePreflight({
				preflight: { ...preflight, sourceSchemasHidden: false },
				expectedDatabase: "synthetic_source",
				expectedRole: "rehearsal_export_login",
				expectedViews: [
					"migration_history_v1",
					"profiles_v1",
					"source_scope_v1",
				],
				...ownerOptions,
			}),
		).toThrow("failed closed: sourceSchemasHidden");
		expect(() =>
			assertSourcePreflight({
				preflight: {
					...preflight,
					roleSafe: false,
					cannotCreateDatabaseObjects: false,
				},
				expectedDatabase: "synthetic_source",
				expectedRole: "rehearsal_export_login",
				expectedViews: [
					"migration_history_v1",
					"profiles_v1",
					"source_scope_v1",
				],
				...ownerOptions,
			}),
		).toThrow("failed closed: roleSafe, cannotCreateDatabaseObjects");
		expect(() =>
			assertSourcePreflight({
				preflight,
				expectedDatabase: "synthetic_source",
				expectedRole: "rehearsal_export_login",
				expectedViews: [
					"migration_history_v1",
					"profiles_v1",
					"saved_drinks_v1",
					"source_scope_v1",
				],
				...ownerOptions,
			}),
		).toThrow("view manifest is not exact");
	});

	it("parses rows only between the two source receipts", async () => {
		const lines = [
			encodeConsistentExportRecord(preflight),
			encodeConsistentExportRecord({
				kind: "row",
				table: "profiles",
				row: { user_id: "synthetic" },
			}),
			encodeConsistentExportRecord({
				kind: "complete",
				transactionReadOnly: true,
			}),
		];
		let observedPreflight;
		await expect(
			Array.fromAsync(
				parseConsistentExportLines({
					lines,
					expectedDatabase: "synthetic_source",
					expectedRole: "rehearsal_export_login",
					expectedViews: [
						"migration_history_v1",
						"profiles_v1",
						"source_scope_v1",
					],
					...ownerOptions,
					onPreflight: (value) => {
						observedPreflight = value;
					},
				}),
			),
		).resolves.toEqual([{ table: "profiles", row: { user_id: "synthetic" } }]);
		expect(observedPreflight.migrationHistory).toHaveLength(1);
	});

	it("rejects incomplete, reordered, or non-JSON source output", async () => {
		const options = {
			expectedDatabase: "synthetic_source",
			expectedRole: "rehearsal_export_login",
			expectedViews: ["migration_history_v1", "profiles_v1", "source_scope_v1"],
			...ownerOptions,
		};
		await expect(
			Array.fromAsync(
				parseConsistentExportLines({
					lines: [encodeConsistentExportRecord(preflight)],
					...options,
				}),
			),
		).rejects.toThrow("without complete receipts");
		await expect(
			Array.fromAsync(
				parseConsistentExportLines({
					lines: [
						encodeConsistentExportRecord(preflight),
						encodeConsistentExportRecord({
							kind: "complete",
							transactionReadOnly: true,
						}),
						encodeConsistentExportRecord({
							kind: "row",
							table: "profiles",
							row: {},
						}),
					],
					...options,
				}),
			),
		).rejects.toThrow("stream order is invalid");
		await expect(
			Array.fromAsync(
				parseConsistentExportLines({ lines: ["not-json"], ...options }),
			),
		).rejects.toThrow("invalid record envelope");
	});

	it("refuses a table without a deterministic primary key", () => {
		expect(() =>
			buildConsistentExportSql({
				manifest: {
					tables: [
						{
							name: "unsafe",
							sourceRows: "STREAM AND SANITIZE",
							columns: [{ name: "value", primaryKey: false }],
						},
					],
				},
			}),
		).toThrow("no deterministic primary-key order");
	});
});
