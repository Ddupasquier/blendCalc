import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	createPrivacyEngine,
	validateExecutablePrivacyPolicy,
} from "@rehearsal-db/core/privacy";
import { validateSourceAccessPolicy } from "@rehearsal-db/core/source-access";
const readPolicy = (folder, filename) =>
	JSON.parse(
		readFileSync(`infrastructure/rehearsal/${folder}/${filename}`, "utf8"),
	);
const primary = readPolicy("application", "privacy-policy.v2.json");
const previous = readPolicy("application", "sanitization-policy.json");
describe("BlendCalc's reviewed native privacy declarations", () => {
	it.each(["application", "publication"])(
		"classifies every exported column in %s without a callback",
		(folder) => {
			const privacy = readPolicy(folder, "privacy-policy.v2.json");
			const source = readPolicy(folder, "source-access-policy.json");
			expect(privacy.policyVersion).toBe(2);
			expect(() => validateExecutablePrivacyPolicy(privacy)).not.toThrow();
			expect(() => validateSourceAccessPolicy(source)).not.toThrow();
			const tables = new Map(
				privacy.tables.map((table) => [
					`${table.schema ?? "public"}.${table.name}`,
					table,
				]),
			);
			expect(tables.size).toBe(source.relations.length);
			for (const relation of source.relations) {
				const table = tables.get(
					`${relation.targetSchema}.${relation.targetTable}`,
				);
				expect(table, relation.view).toBeDefined();
				expect(new Set(table.columns.map((column) => column.name))).toEqual(
					new Set(relation.columns),
				);
				for (const column of table.columns) {
					expect([
						"KEEP",
						"PSEUDONYMIZE",
						"REPLACE",
						"DERIVE",
						"EXCLUDE",
					]).toContain(column.action);
				}
			}
		},
	);
	it("retains explicit transformations for all 27 reviewed private structured fields", () => {
		const fields = previous.tables
			.filter((table) => table.sourceRows !== "EXCLUDE")
			.flatMap((table) =>
				table.columns
					.filter(
						(column) =>
							column.dataType === "jsonb" &&
							column.action !== "EXCLUDE" &&
							column.action !== "KEEP EXACTLY",
					)
					.map((column) => `${table.name}.${column.name}`),
			);
		expect(fields).toHaveLength(27);
		const actual = new Map(
			primary.tables.flatMap((table) =>
				table.columns.map((column) => [`${table.name}.${column.name}`, column]),
			),
		);
		for (const field of fields) {
			const column = actual.get(field);
			expect(column, field).toBeDefined();
			expect(column.action, field).toBe("DERIVE");
			expect(column.recipe, field).toBeDefined();
		}
	});
	it("preserves commercial brand names but pseudonymizes Auth relationships coherently", () => {
		const products = primary.tables.find(
			(table) => table.name === "shared_products",
		);
		expect(
			products.columns.find((column) => column.name === "brand_owner").action,
		).toBe("KEEP");
		for (const table of primary.tables) {
			for (const column of table.columns) {
				if (
					column.foreignKey?.schema !== "auth" ||
					column.foreignKey?.table !== "users"
				)
					continue;
				expect(column, `${table.name}.${column.name}`).toMatchObject({
					action: "PSEUDONYMIZE",
					recipe: { format: "uuid", namespace: "identity:auth.users.id" },
				});
			}
		}
		expect(primary.pathMappings["owner-storage"].namespace).toBe(
			"identity:auth.users.id",
		);
	});
	it("keeps permitted owner text and images while withholding uncopied non-owner avatars", () => {
		const owner = "11111111-1111-4111-8111-111111111111";
		const other = "22222222-2222-4222-8222-222222222222";
		const profiles = structuredClone(
			primary.tables.find((table) => table.name === "profiles"),
		);
		profiles.columns = profiles.columns.filter((column) =>
			["user_id", "bio", "avatar_path"].includes(column.name),
		);
		const policy = {
			...primary,
			tables: [profiles],
			bindings: {
				"approved-owner": {
					environmentVariable: "REHEARSAL_APPROVED_OWNER_ID",
					approvedValueSha256: createHash("sha256").update(owner).digest("hex"),
				},
			},
		};
		const engine = createPrivacyEngine({
			policy,
			key: Buffer.alloc(32, 7),
			environment: { REHEARSAL_APPROVED_OWNER_ID: owner },
		});
		const kept = engine.sanitize({
			table: "profiles",
			row: {
				user_id: owner,
				bio: "Permitted copied profile text.",
				avatar_path: `${owner}/avatar.png`,
			},
		}).row;
		expect(kept.bio).toBe("Permitted copied profile text.");
		expect(kept.user_id).not.toBe(owner);
		expect(kept.avatar_path).toBe(`${kept.user_id}/avatar.png`);
		const sanitized = engine.sanitize({
			table: "profiles",
			row: {
				user_id: other,
				bio: "Other owner's private text.",
				avatar_path: `${other}/uncopied.png`,
			},
		}).row;
		expect(sanitized.bio).not.toBe("Other owner's private text.");
		expect(sanitized.avatar_path).toBeNull();
	});
});
