import { describe, expect, it } from "vitest";
import {
	configureRuntime,
	prepareSchema,
	verifyRuntime,
} from "../../infrastructure/rehearsal/application/runtime_adapter.mjs";

describe("BlendCalc Rehearsal runtime adapter", () => {
	it("installs only the public-schema extension required by production", () => {
		const statements = [];
		const result = prepareSchema({
			runSql(statement) {
				statements.push(statement);
			},
		});

		expect(statements).toEqual([
			expect.stringContaining(
				"create extension if not exists pg_trgm with schema public",
			),
		]);
		expect(result.message).toContain("extension prerequisites");
	});

	it("configures the approved owner persona without replacing production-shaped profile data", () => {
		const statements = [];
		const result = configureRuntime({
			runSql(statement) {
				statements.push(statement);
				return "";
			},
			environment: {
				apiUrl: "http://127.0.0.1:58321",
				publishableKey: "local-publishable-key",
				serviceRoleKey: "local-service-role-key",
			},
			baseline: {
				generationId: "fixture-baseline",
				ownerPersonaUserId: "11111111-1111-4111-8111-111111111111",
				ownerEmailSha256: "a".repeat(64),
			},
		});

		expect(statements[0]).not.toContain("display_name = 'Rehearsal Developer'");
		expect(statements[0]).toContain("claim_rehearsal_owner_persona");
		expect(statements[0]).toContain(
			"update public.profile_image_policy_acceptances",
		);
		expect(statements[0]).toContain("update public.profile_image_reports");
		expect(statements[0]).toContain(
			"update public.food_compatibility_feedback",
		);
		expect(statements[0]).toContain("update public.shared_product_submissions");
		expect(statements[0]).toContain("update storage.objects");
		expect(statements[0]).toContain(
			"insert into public.catalog_monitor_settings (id, enabled)",
		);
		expect(statements[0]).toContain("values (true, false)");
		expect(result.environmentVariables).toMatchObject({
			BLENDCALC_REHEARSAL_ACCOUNT_EMAIL: "rehearsal-owner@blendcalc.local",
			BLENDCALC_REHEARSAL_ACCOUNT_PASSWORD: "BlendCalc-Local-Rehearsal-2026!",
			BLENDCALC_REHEARSAL_BASELINE_ID: "fixture-baseline",
			BLENDCALC_REHEARSAL_OWNER_PERSONA_ID:
				"11111111-1111-4111-8111-111111111111",
			BLENDCALC_REHEARSAL_OWNER_EMAIL_SHA256: "a".repeat(64),
		});
	});

	it("proves the complete local Google owner claim inside a rollback", () => {
		const statements = [];
		const result = verifyRuntime({
			runSql(statement) {
				statements.push(statement);
			},
			baseline: {
				ownerPersonaUserId: "11111111-1111-4111-8111-111111111111",
				ownerEmailSha256:
					"38a906215625585aeaab2bd2530113ea2a631c41f2dd2a702d59968d17c9de89",
			},
		});

		expect(statements).toHaveLength(1);
		expect(statements[0]).toContain("begin;");
		expect(statements[0]).toContain("claim_rehearsal_owner_persona");
		expect(statements[0]).toContain("rollback;");
		expect(result.message).toContain("atomically claims");
	});

	it("leaves a real production owner claim for owner verification", () => {
		const statements = [];
		const result = verifyRuntime({
			runSql(statement) {
				statements.push(statement);
			},
			baseline: {
				ownerPersonaUserId: "11111111-1111-4111-8111-111111111111",
				ownerEmailSha256: "a".repeat(64),
			},
		});

		expect(statements).toHaveLength(0);
		expect(result.message).toContain("real Google identity");
	});
});
