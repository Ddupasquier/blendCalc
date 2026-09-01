import { describe, expect, it } from "vitest";
import {
	BLENDCALC_API_INTAKE_V1,
	BLENDCALC_API_INTAKE_V1_SECTIONS,
	type BlendCalcAPIIntakeV1ProductObservation,
} from "$lib/blendCalcAPI/intake/v1/blendCalcAPIIntakeTypes";

const observation = {
	intakeVersion: BLENDCALC_API_INTAKE_V1,
	purpose: "catalog-correction",
	observedAt: "2026-09-01T12:00:00.000Z",
	evidence: [
		{
			clientEvidenceId: "front-label",
			kind: "image",
			role: "front-label",
			mediaType: "image/jpeg",
			byteLength: 120_000,
			sha256: "a".repeat(64),
			capturedAt: "2026-09-01T11:59:00.000Z",
		},
		{
			clientEvidenceId: "nutrition-label",
			kind: "image",
			role: "nutrition-label",
			mediaType: "image/jpeg",
			byteLength: 140_000,
			sha256: "b".repeat(64),
			capturedAt: "2026-09-01T11:59:30.000Z",
		},
	],
	observation: {
		identity: {
			productName: {
				value: "Example Cookies",
				languageCode: "en",
				evidenceIds: ["front-label"],
			},
			brandName: {
				value: "Example Foods",
				languageCode: "en",
				evidenceIds: ["front-label"],
			},
			packageDescription: null,
		},
		labelRevision: {
			labelObservedAt: "2026-09-01T11:59:00.000Z",
			manufacturerEffectiveAt: null,
			sourceRevision: null,
			expectedCanonicalProductId: "11111111-1111-4111-8111-111111111111",
			expectedCanonicalRevisionNumber: 2,
			evidenceIds: ["front-label", "nutrition-label"],
		},
		servings: {
			state: "reported",
			values: [
				{
					clientServingId: "cookie",
					label: "1 cookie",
					amount: 1,
					unit: "cookie",
					measureType: "count",
					gramWeight: null,
					milliliterVolume: null,
					isPrimary: true,
					isHouseholdMeasure: true,
					evidenceIds: ["nutrition-label"],
				},
			],
		},
		nutrients: {
			state: "reported",
			values: [
				{
					nutrientId: 1008,
					sourceNutrientName: "Energy",
					sourceNutrientCode: null,
					amount: 90,
					unit: "kcal",
					valueStatus: "reported",
					basis: { kind: "serving", servingId: "cookie" },
					statement: null,
					evidenceIds: ["nutrition-label"],
				},
				{
					nutrientId: 1093,
					sourceNutrientName: "Sodium",
					sourceNutrientCode: null,
					amount: 0,
					unit: "mg",
					valueStatus: "reported-zero",
					basis: { kind: "serving", servingId: "cookie" },
					statement: null,
					evidenceIds: ["nutrition-label"],
				},
			],
		},
		ingredients: {
			state: "reported",
			statement: "Wheat flour, sugar",
			languageCode: "en",
			items: [],
			evidenceIds: ["front-label"],
		},
		allergens: {
			state: "reported",
			contains: ["Wheat"],
			mayContain: [],
			precautionaryStatements: [],
			evidenceIds: ["front-label"],
		},
		categories: {
			state: "reported",
			values: [
				{
					label: "Cookies",
					canonicalOptionId: "snacks",
					evidenceIds: ["front-label"],
				},
			],
		},
		identifiers: {
			state: "reported",
			values: [
				{
					type: "gtin",
					value: "00000000000000",
					issuer: null,
					isPrimary: true,
					evidenceIds: ["front-label"],
				},
			],
		},
		images: {
			state: "reported",
			values: [
				{
					evidenceId: "front-label",
					role: "front",
					altText: "Front of Example Cookies package",
					intendedUse: "catalog-candidate",
				},
			],
		},
	},
} satisfies BlendCalcAPIIntakeV1ProductObservation;

describe("blendCalcAPI app-only intake v1 contract", () => {
	it("covers every evidence-backed observation section", () => {
		expect(Object.keys(observation.observation)).toEqual(
			BLENDCALC_API_INTAKE_V1_SECTIONS,
		);
	});

	it("preserves exact count servings without inventing a mass conversion", () => {
		expect(observation.observation.servings.values[0]).toMatchObject({
			label: "1 cookie",
			measureType: "count",
			gramWeight: null,
			milliliterVolume: null,
		});
	});

	it("distinguishes reported zero from an unreported nutrient", () => {
		expect(observation.observation.nutrients.values[1]).toMatchObject({
			amount: 0,
			valueStatus: "reported-zero",
		});
		expect(
			observation.observation.nutrients.values.some(
				(nutrient) => nutrient.sourceNutrientName === "Dietary fiber",
			),
		).toBe(false);
	});

	it("links every referenced field and image to declared evidence", () => {
		const evidenceIds = new Set(
			observation.evidence.map(({ clientEvidenceId }) => clientEvidenceId),
		);
		for (const evidenceId of [
			...observation.observation.identity.productName.evidenceIds,
			...observation.observation.labelRevision.evidenceIds,
			...observation.observation.servings.values.flatMap(
				(serving) => serving.evidenceIds,
			),
			...observation.observation.nutrients.values.flatMap(
				(nutrient) => nutrient.evidenceIds,
			),
			...observation.observation.images.values.map((image) => image.evidenceId),
		]) {
			expect(evidenceIds.has(evidenceId)).toBe(true);
		}
	});

	it("contains no account, moderation, storage, or canonical publication decision", () => {
		const serialized = JSON.stringify(observation);
		for (const privateField of [
			"userId",
			"submittedBy",
			"reviewedBy",
			"approvedBy",
			"storagePath",
			"publicationStatus",
		]) {
			expect(serialized).not.toContain(`"${privateField}"`);
		}
	});
});
