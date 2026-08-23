type JsonRecord = Record<string, unknown>;

export type NutrientMappingCandidate = {
	nutrientId: number;
	nutrientName: string;
	nutrientNumber: string | null;
	defaultUnitName: string;
};

export type CompatibleNutrientMappingCandidate = NutrientMappingCandidate & {
	conversionMultiplier: number;
};

export type NutrientMappingReviewWorkspace = {
	mapping: {
		id: string;
		sourceKey: string;
		sourceDisplayName: string;
		sourceNutrientKey: string;
		sourceNutrientName: string | null;
		sourceUnitName: string;
		mappingMethod: string;
		confidence: number;
		observationCount: number;
		reviewStatus: string;
		reviewReference: string | null;
		reviewedAt: string | null;
		candidateReason: string | null;
		currentNutrient: NutrientMappingCandidate;
	};
	compatibleNutrients: CompatibleNutrientMappingCandidate[];
	latestDecision: {
		id: string;
		outcome: string;
		selectedNutrientId: number | null;
		reviewNote: string;
		evidenceReference: string | null;
		reviewedAt: string;
	} | null;
};

export type NutrientMappingReviewDecisionResult = {
	decisionId: string;
	mappingId: string;
	outcome: "approved" | "excluded";
	reviewStatus: "approved" | "rejected";
	enabled: boolean;
	selectedNutrientId: number | null;
};

export type NutrientMappingReviewActionData = {
	nutrientMappingReviewError?: string;
	nutrientMappingReviewSuccess?: string;
	nutrientMappingReviewResult?: NutrientMappingReviewDecisionResult;
};

const readRecord = (value: unknown, field: string): JsonRecord => {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new TypeError(`Invalid nutrient mapping review field: ${field}`);
	}
	return value as JsonRecord;
};

const readString = (value: unknown, field: string): string => {
	if (typeof value !== "string" || value.length === 0) {
		throw new TypeError(`Invalid nutrient mapping review field: ${field}`);
	}
	return value;
};

const readNullableString = (value: unknown, field: string): string | null =>
	value === null ? null : readString(value, field);

const readNumber = (value: unknown, field: string): number => {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		throw new TypeError(`Invalid nutrient mapping review field: ${field}`);
	}
	return value;
};

const readInteger = (value: unknown, field: string): number => {
	const number = readNumber(value, field);
	if (!Number.isSafeInteger(number)) {
		throw new TypeError(`Invalid nutrient mapping review field: ${field}`);
	}
	return number;
};

const readNullableInteger = (value: unknown, field: string): number | null =>
	value === null ? null : readInteger(value, field);

const readBoolean = (value: unknown, field: string): boolean => {
	if (typeof value !== "boolean") {
		throw new TypeError(`Invalid nutrient mapping review field: ${field}`);
	}
	return value;
};

const parseNutrient = (
	value: unknown,
	field: string,
): NutrientMappingCandidate => {
	const nutrient = readRecord(value, field);
	return {
		nutrientId: readInteger(nutrient.nutrientId, `${field}.nutrientId`),
		nutrientName: readString(nutrient.nutrientName, `${field}.nutrientName`),
		nutrientNumber: readNullableString(
			nutrient.nutrientNumber,
			`${field}.nutrientNumber`,
		),
		defaultUnitName: readString(
			nutrient.defaultUnitName,
			`${field}.defaultUnitName`,
		),
	};
};

export const parseNutrientMappingReviewWorkspace = (
	value: unknown,
): NutrientMappingReviewWorkspace => {
	const root = readRecord(value, "root");
	const mapping = readRecord(root.mapping, "mapping");
	const compatibleNutrients = root.compatibleNutrients;
	if (!Array.isArray(compatibleNutrients)) {
		throw new TypeError("Invalid nutrient mapping review field: compatibleNutrients");
	}
	const latestDecision = root.latestDecision === null
		? null
		: readRecord(root.latestDecision, "latestDecision");

	return {
		mapping: {
			id: readString(mapping.id, "mapping.id"),
			sourceKey: readString(mapping.sourceKey, "mapping.sourceKey"),
			sourceDisplayName: readString(
				mapping.sourceDisplayName,
				"mapping.sourceDisplayName",
			),
			sourceNutrientKey: readString(
				mapping.sourceNutrientKey,
				"mapping.sourceNutrientKey",
			),
			sourceNutrientName: readNullableString(
				mapping.sourceNutrientName,
				"mapping.sourceNutrientName",
			),
			sourceUnitName: readString(
				mapping.sourceUnitName,
				"mapping.sourceUnitName",
			),
			mappingMethod: readString(mapping.mappingMethod, "mapping.mappingMethod"),
			confidence: readNumber(mapping.confidence, "mapping.confidence"),
			observationCount: readInteger(
				mapping.observationCount,
				"mapping.observationCount",
			),
			reviewStatus: readString(mapping.reviewStatus, "mapping.reviewStatus"),
			reviewReference: readNullableString(
				mapping.reviewReference,
				"mapping.reviewReference",
			),
			reviewedAt: readNullableString(mapping.reviewedAt, "mapping.reviewedAt"),
			candidateReason: readNullableString(
				mapping.candidateReason,
				"mapping.candidateReason",
			),
			currentNutrient: parseNutrient(
				mapping.currentNutrient,
				"mapping.currentNutrient",
			),
		},
		compatibleNutrients: compatibleNutrients.map((nutrient, index) => {
			const field = `compatibleNutrients[${index}]`;
			return {
				...parseNutrient(nutrient, field),
				conversionMultiplier: readNumber(
					readRecord(nutrient, field).conversionMultiplier,
					`${field}.conversionMultiplier`,
				),
			};
		}),
		latestDecision: latestDecision
			? {
				id: readString(latestDecision.id, "latestDecision.id"),
				outcome: readString(latestDecision.outcome, "latestDecision.outcome"),
				selectedNutrientId: readNullableInteger(
					latestDecision.selectedNutrientId,
					"latestDecision.selectedNutrientId",
				),
				reviewNote: readString(
					latestDecision.reviewNote,
					"latestDecision.reviewNote",
				),
				evidenceReference: readNullableString(
					latestDecision.evidenceReference,
					"latestDecision.evidenceReference",
				),
				reviewedAt: readString(
					latestDecision.reviewedAt,
					"latestDecision.reviewedAt",
				),
			}
			: null,
	};
};

export const parseNutrientMappingReviewDecisionResult = (
	value: unknown,
): NutrientMappingReviewDecisionResult => {
	const result = readRecord(value, "root");
	const outcome = readString(result.outcome, "outcome");
	const reviewStatus = readString(result.reviewStatus, "reviewStatus");
	if (outcome !== "approved" && outcome !== "excluded") {
		throw new TypeError("Invalid nutrient mapping review field: outcome");
	}
	if (reviewStatus !== "approved" && reviewStatus !== "rejected") {
		throw new TypeError("Invalid nutrient mapping review field: reviewStatus");
	}
	return {
		decisionId: readString(result.decisionId, "decisionId"),
		mappingId: readString(result.mappingId, "mappingId"),
		outcome,
		reviewStatus,
		enabled: readBoolean(result.enabled, "enabled"),
		selectedNutrientId: readNullableInteger(
			result.selectedNutrientId,
			"selectedNutrientId",
		),
	};
};
