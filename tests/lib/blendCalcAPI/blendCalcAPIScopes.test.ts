import {
	BLENDCALC_API_OPERATION_SCOPE_REQUIREMENTS,
	BLENDCALC_API_SCOPE_KEYS,
	canBlendCalcAPIScopesPerformOperation,
	readValidBlendCalcAPIScopes,
} from "$lib/blendCalcAPI/blendCalcAPIScopes";
import { describe, expect, it } from "vitest";

describe("blendCalcAPI scopes", () => {
	it("requires a reviewed scope for every bounded operation", () => {
		expect(BLENDCALC_API_OPERATION_SCOPE_REQUIREMENTS).toEqual({
			"catalog.read": "catalog.read",
			"intake.submit": "intake.write",
			"corrections.submit": "corrections.write",
			"moderation.read": "moderation.read",
			"moderation.resolve": "moderation.write",
			"administration.manage": "administration",
		});
	});

	it("keeps ordinary read and write scopes isolated", () => {
		expect(
			canBlendCalcAPIScopesPerformOperation(["catalog.read"], "catalog.read"),
		).toBe(true);
		expect(
			canBlendCalcAPIScopesPerformOperation(["catalog.read"], "intake.submit"),
		).toBe(false);
		expect(
			canBlendCalcAPIScopesPerformOperation(
				["intake.write"],
				"corrections.submit",
			),
		).toBe(false);
		expect(
			canBlendCalcAPIScopesPerformOperation(
				["corrections.write"],
				"moderation.read",
			),
		).toBe(false);
	});

	it("allows moderation writes to read moderation work without granting administration", () => {
		expect(
			canBlendCalcAPIScopesPerformOperation(
				["moderation.write"],
				"moderation.read",
			),
		).toBe(true);
		expect(
			canBlendCalcAPIScopesPerformOperation(
				["moderation.write"],
				"administration.manage",
			),
		).toBe(false);
	});

	it("allows administration to perform every registered operation", () => {
		for (const operation of Object.keys(
			BLENDCALC_API_OPERATION_SCOPE_REQUIREMENTS,
		) as Array<keyof typeof BLENDCALC_API_OPERATION_SCOPE_REQUIREMENTS>) {
			expect(
				canBlendCalcAPIScopesPerformOperation(["administration"], operation),
			).toBe(true);
		}
	});

	it("fails closed when persisted scopes are unknown", () => {
		expect(readValidBlendCalcAPIScopes(BLENDCALC_API_SCOPE_KEYS)).toEqual(
			BLENDCALC_API_SCOPE_KEYS,
		);
		expect(() =>
			readValidBlendCalcAPIScopes(["catalog.read", "catalog.everything"]),
		).toThrow("Stored blendCalcAPI access scopes are invalid.");
	});
});
