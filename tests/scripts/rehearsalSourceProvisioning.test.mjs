import { describe, expect, it } from "vitest";
import {
	buildRehearsalSourceDeprovisioningSql,
	buildRehearsalSourceProvisioningSql,
	buildRehearsalStorageBindingSql,
	createRehearsalSourceDatabaseUrl,
	createRehearsalSourceEnvironment,
	selectRehearsalSourceOwner,
} from "../../scripts/lib/rehearsal/source_provisioning.mjs";

const ownerUserId = "11111111-1111-4111-8111-111111111111";
const storageUserId = "22222222-2222-4222-8222-222222222222";
const projectReference = "abcdefghijklmnopqrst";

describe("Rehearsal production source provisioning", () => {
	it("selects only one Google-linked admin or developer owner", () => {
		const owner = {
			id: ownerUserId,
			email: "owner@example.test",
			identities: [{ provider: "google" }],
		};
		expect(
			selectRehearsalSourceOwner({
				assignments: [{ user_id: ownerUserId, role: "admin" }],
				usersById: new Map([[ownerUserId, owner]]),
			}),
		).toEqual({
			assignment: { user_id: ownerUserId, role: "admin" },
			user: owner,
		});
		expect(() =>
			selectRehearsalSourceOwner({ assignments: [], usersById: new Map() }),
		).toThrow("exactly one");
		expect(() =>
			selectRehearsalSourceOwner({
				assignments: [{ user_id: ownerUserId, role: "admin" }],
				usersById: new Map([
					[ownerUserId, { ...owner, identities: [{ provider: "email" }] }],
				]),
			}),
		).toThrow("not linked to Google");
	});

	it("builds an idempotent least-privilege database boundary", () => {
		const sql = buildRehearsalSourceProvisioningSql({
			databasePassword: "a".repeat(64),
			credentialValidUntil: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
			ownerUserId,
			ownerEmailSha256: "b".repeat(64),
		});

		expect(sql).toContain(
			"revoke all on schema public, auth, storage, extensions, net",
		);
		expect(sql).toContain("revoke usage on schema net from public");
		expect(sql).toContain(
			"revoke execute on all functions in schema net from public",
		);
		expect(sql).toContain("default_transaction_read_only = on");
		expect(sql).toContain("grant rehearsal_export_reader");
		expect(sql).toContain("not membership.set_option");
		expect(sql).toContain("on conflict (login_role) do update");
		expect(sql).toContain("valid until");
	});

	it("binds the Storage user to one owner and removes its app profile", () => {
		const sql = buildRehearsalStorageBindingSql({
			storageUserId,
			storageEmail: "rehearsal@example.test",
			ownerUserId,
		});

		expect(sql).toContain("role = 'rehearsal_storage_reader'");
		expect(sql).toContain("production_source_storage_reader");
		expect(sql).toContain("delete from public.profiles");
	});

	it("removes only the dedicated database identity after proving it owns nothing", () => {
		const sql = buildRehearsalSourceDeprovisioningSql();

		expect(sql).toContain("delete from rehearsal_export.source_scopes");
		expect(sql).toContain('alter role "rehearsal_source" nologin');
		expect(sql).toContain(
			'revoke all on database postgres from "rehearsal_source"',
		);
		expect(sql).toContain('drop role "rehearsal_source"');
		expect(sql).toContain("unexpectedly owns database objects");
		expect(() =>
			buildRehearsalSourceDeprovisioningSql({ loginRole: "postgres" }),
		).toThrow("Unsafe Rehearsal source role");
	});

	it("creates a pooler URL and exact five-value source environment", () => {
		const databaseUrl = createRehearsalSourceDatabaseUrl({
			poolerUrl: `postgresql://postgres.${projectReference}@aws-1-us-west-2.pooler.supabase.com:5432/postgres`,
			projectReference,
			databasePassword: "a".repeat(64),
		});
		expect(new URL(databaseUrl).username).toBe(
			`rehearsal_source.${projectReference}`,
		);
		expect(new URL(databaseUrl).searchParams.get("sslmode")).toBe("require");

		const source = createRehearsalSourceEnvironment({
			databaseUrl,
			storageUrl: `https://${projectReference}.supabase.co`,
			publishableKey: "publishable",
			storageAccessToken: "storage-access-token",
			storageRefreshToken: "storage-refresh-token",
		});
		expect(source.trim().split("\n")).toHaveLength(5);
		expect(source).not.toContain("SERVICE_ROLE");
	});
});
