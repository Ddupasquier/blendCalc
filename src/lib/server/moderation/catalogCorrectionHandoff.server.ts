import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import type { Json } from "$lib/types/database.types";
import {
	getCatalogFieldLabel,
	getCatalogIssueCodeLabel,
	getCatalogIssueReasonLabel,
} from "$lib/utils/moderation/catalogHealthMessages";
import { formatCatalogEvidenceValue } from "$lib/utils/moderation/catalogReviewWork";
import type { CatalogProductReadinessIssue } from "$lib/utils/moderation/catalogProductReadinessPassport";

export type CatalogCorrectionFinding = {
	id: string;
	type:
		| "catalog_conflict"
		| "provider_change"
		| "food_warning_report"
		| "readiness_issue";
	label: string;
	fieldLabel: string;
	comparisonBasis: string | null;
	affectedFieldPaths: string[];
	detail?: string;
	currentValue: CatalogConflictEvidence | null;
	evidence: CatalogConflictEvidence[];
	status: "needs_correction" | "correction_submitted" | "resolved";
	submissionId: string | null;
};

export type CatalogConflictEvidence = {
	index: number | null;
	source: string;
	sourceKey: string;
	sourceReference: string | null;
	value: string;
	amountPer100g: number | null;
	unit: string | null;
	observedAt: string | null;
	sourceType: string | null;
	sourceUrl: string | null;
	redistributionAllowed: boolean | null;
};

type JsonRecord = Record<string, Json | undefined>;

const NUTRIENT_FIELD_PREFIX = "nutrient:";

const readJsonRecord = (value: Json | undefined): JsonRecord | null =>
	value && typeof value === "object" && !Array.isArray(value)
		? (value as JsonRecord)
		: null;

const readNutrientId = (fieldPath: string): number | null => {
	if (!fieldPath.startsWith(NUTRIENT_FIELD_PREFIX)) return null;
	const nutrientId = Number(fieldPath.slice(NUTRIENT_FIELD_PREFIX.length));
	return Number.isSafeInteger(nutrientId) && nutrientId > 0 ? nutrientId : null;
};

const formatUnit = (unit: string) =>
	({ G: "g", MG: "mg", UG: "µg", MCG: "µg", KCAL: "kcal", KJ: "kJ" })[
		unit.toUpperCase()
	] ?? unit;

const formatValueWithContext = (
	value: Json | undefined,
	unit: Json | undefined,
	basis: Json | undefined,
) => {
	const formattedValue = formatCatalogEvidenceValue(value);
	const formattedUnit = typeof unit === "string" ? formatUnit(unit) : null;
	const formattedBasis = typeof basis === "string" ? basis : null;
	return [
		formattedUnit ? `${formattedValue} ${formattedUnit}` : formattedValue,
		formattedBasis,
	]
		.filter(Boolean)
		.join(" · ");
};

const formatSource = (
	source: string,
	sourceReference: Json | undefined,
	sourceNames: Map<string, string>,
) => {
	const sourceName = sourceNames.get(source) ?? source;
	return typeof sourceReference === "string" && sourceReference.trim()
		? `${sourceName} · record ${sourceReference}`
		: sourceName;
};

const readCurrentFoodValue = (
	product: {
		product_name: string;
		brand_owner: string | null;
		food: Json;
		source: string;
		source_reference: string | null;
		canonical_provenance: Json;
	},
	fieldPath: string,
	sourceNames: Map<string, string>,
): { source: string; value: string } | null => {
	const food = readJsonRecord(product.food);
	if (!food) return null;
	const values: Record<string, Json | undefined> = {
		productName: product.product_name,
		brandOwner: product.brand_owner,
		category: food.brandedFoodCategory ?? food.foodCategory ?? food.categories,
		categories:
			food.categories ?? food.brandedFoodCategory ?? food.foodCategory,
		servingWeightGrams: food.customServingWeightGrams ?? food.servingSize,
		householdServing: food.householdServingFullText ?? food.customServingLabel,
		ingredients: food.ingredients ?? food.ingredientList,
		allergens: food.allergens ?? food.allergenDisclosure,
		traces: food.traces,
		precautionaryStatements: food.precautionaryStatements,
		dietaryTags: food.dietaryTags,
		package: food.packageQuantity ?? food.packageWeight,
		sourceMetadata: food.sourceMetadata,
	};
	const value = values[fieldPath] ?? food[fieldPath];
	if (value === undefined || value === null || value === "") return null;
	const provenancePath =
		(
			{
				category: "categories",
				householdServing: "serving",
				servingWeightGrams: "serving",
			} as Record<string, string>
		)[fieldPath] ?? fieldPath;
	const foodProvenance = readJsonRecord(food.fieldProvenance);
	const provenance = readJsonRecord(product.canonical_provenance);
	const fieldProvenance =
		readJsonRecord(foodProvenance?.[provenancePath]) ??
		readJsonRecord(provenance?.[provenancePath]);
	const source =
		typeof fieldProvenance?.source === "string"
			? fieldProvenance.source
			: product.source;
	const sourceReference =
		fieldProvenance?.sourceReference ?? product.source_reference;
	return {
		source: formatSource(source, sourceReference, sourceNames),
		value:
			fieldPath === "servingWeightGrams"
				? `${formatCatalogEvidenceValue(value)} g`
				: formatCatalogEvidenceValue(value),
	};
};

export type CatalogCorrectionHandoff = {
	applicationFoodId: number | null;
	servingWeightGrams?: number | null;
	decisionWorkbenchAvailable?: boolean;
	pendingSubmissionId: string | null;
	findings: CatalogCorrectionFinding[];
};

const isActionableConflictViewUnavailable = (error: {
	code?: string;
	message?: string;
}) =>
	["42P01", "PGRST205"].includes(error.code ?? "") ||
	(error.message ?? "").includes("catalog_actionable_product_conflicts");

const readApplicationFoodId = (food: Json): number | null => {
	if (!food || typeof food !== "object" || Array.isArray(food)) return null;
	const value = (food as Record<string, Json | undefined>).fdcId;
	const numeric = typeof value === "number" ? value : Number(value);
	return Number.isSafeInteger(numeric) && numeric !== 0 ? numeric : null;
};

const readServingWeightGrams = (food: Json): number | null => {
	const record = readJsonRecord(food);
	if (!record) return null;
	const rawValue = record.customServingWeightGrams ?? record.servingSize;
	const value = typeof rawValue === "number" ? rawValue : Number(rawValue);
	return Number.isFinite(value) && value > 0 ? value : null;
};

export const readCatalogCorrectionHandoff = async (
	sharedProductId: string,
	readinessIssues: CatalogProductReadinessIssue[] = [],
): Promise<CatalogCorrectionHandoff> => {
	const admin = getSupabaseAdminClient();
	const actionableConflictResult = await admin
		.from("catalog_actionable_product_conflicts")
		.select("id, field_path, observed_values")
		.eq("shared_product_id", sharedProductId)
		.eq("status", "open")
		.order("created_at", { ascending: true });
	const decisionWorkbenchAvailable = !(
		actionableConflictResult.error &&
		isActionableConflictViewUnavailable(actionableConflictResult.error)
	);
	const conflictResult = decisionWorkbenchAvailable
		? actionableConflictResult
		: await admin
				.from("shared_product_conflicts")
				.select("id, field_path, observed_values")
				.eq("shared_product_id", sharedProductId)
				.eq("status", "open")
				.order("created_at", { ascending: true });
	const [productResult, providerResult, originResult, pendingSubmissionResult] =
		await Promise.all([
			admin
				.from("shared_products")
				.select(
					"food, product_name, brand_owner, source, source_reference, canonical_provenance, last_verified_at",
				)
				.eq("id", sharedProductId)
				.maybeSingle(),
			admin
				.from("catalog_provider_change_reviews")
				.select("id, material_field_paths")
				.eq("shared_product_id", sharedProductId)
				.eq("status", "pending")
				.order("created_at", { ascending: true }),
			admin
				.from("catalog_correction_origins")
				.select(
					"id, origin_type, provider_change_review_id, shared_product_conflict_id, food_compatibility_feedback_id, affected_field_paths, status, submission_id",
				)
				.eq("shared_product_id", sharedProductId)
				.in("status", ["waiting_for_correction", "linked", "resolved"]),
			admin
				.from("shared_product_submissions")
				.select("id")
				.eq("target_shared_product_id", sharedProductId)
				.eq("status", "pending")
				.eq("submission_intent", "catalog_correction")
				.order("created_at", { ascending: false })
				.limit(1)
				.maybeSingle(),
		]);

	const error =
		productResult.error ??
		conflictResult.error ??
		providerResult.error ??
		originResult.error ??
		pendingSubmissionResult.error;
	if (error) throw error;
	const actionableConflicts = (conflictResult.data ?? []).filter(
		(
			conflict,
		): conflict is typeof conflict & {
			id: string;
			field_path: string;
			observed_values: Json;
		} => Boolean(conflict.id && conflict.field_path),
	);

	const origins = originResult.data ?? [];
	const conflictSnapshotIds = actionableConflicts.flatMap((conflict) =>
		Array.isArray(conflict.observed_values)
			? conflict.observed_values.flatMap((value) => {
					if (!value || typeof value !== "object" || Array.isArray(value))
						return [];
					const snapshotId = (value as Record<string, Json>).snapshotId;
					return typeof snapshotId === "string" ? [snapshotId] : [];
				})
			: [],
	);
	const nutrientIds = [
		...new Set(
			actionableConflicts.flatMap((conflict) => {
				const nutrientId = readNutrientId(conflict.field_path);
				return nutrientId === null ? [] : [nutrientId];
			}),
		),
	];
	const [snapshotResult, nutrientDefinitionResult, currentNutrientResult] =
		await Promise.all([
			conflictSnapshotIds.length > 0
				? admin
						.from("catalog_provider_product_snapshots")
						.select("id, provider_key, source_reference, observed_at")
						.in("id", conflictSnapshotIds)
				: Promise.resolve({ data: [], error: null }),
			nutrientIds.length > 0
				? admin
						.from("nutrient_definitions")
						.select("nutrient_id, nutrient_name, default_unit_name")
						.in("nutrient_id", nutrientIds)
				: Promise.resolve({ data: [], error: null }),
			nutrientIds.length > 0
				? admin
						.from("food_nutrients")
						.select(
							"nutrient_id, amount_per_100g, unit_name, source, source_reference",
						)
						.eq("shared_product_id", sharedProductId)
						.in("nutrient_id", nutrientIds)
				: Promise.resolve({ data: [], error: null }),
		]);
	const relatedError =
		snapshotResult.error ??
		nutrientDefinitionResult.error ??
		currentNutrientResult.error;
	if (relatedError) throw relatedError;
	const providerKeys = [
		...new Set(
			[
				...(snapshotResult.data ?? []).map((snapshot) => snapshot.provider_key),
				...(currentNutrientResult.data ?? []).map(
					(nutrient) => nutrient.source,
				),
				...actionableConflicts.flatMap((conflict) =>
					Array.isArray(conflict.observed_values)
						? conflict.observed_values.flatMap((value) => {
								const record = readJsonRecord(value);
								return typeof record?.source === "string"
									? [record.source]
									: [];
							})
						: [],
				),
				...(productResult.data ? [productResult.data.source] : []),
			].filter(Boolean),
		),
	];
	const sourceResult =
		providerKeys.length > 0
			? await admin
					.from("product_data_sources")
					.select(
						"key, display_name, source_type, homepage_url, api_redistribution_allowed",
					)
					.in("key", providerKeys)
			: { data: [], error: null };
	if (sourceResult.error) throw sourceResult.error;
	const sourceNames = new Map(
		(sourceResult.data ?? []).map((source) => [
			source.key,
			source.display_name,
		]),
	);
	const sources = new Map(
		(sourceResult.data ?? []).map((source) => [source.key, source]),
	);
	const snapshots = new Map(
		(snapshotResult.data ?? []).map((snapshot) => [snapshot.id, snapshot]),
	);
	const nutrientDefinitions = new Map(
		(nutrientDefinitionResult.data ?? []).map((definition) => [
			definition.nutrient_id,
			definition,
		]),
	);
	const currentNutrients = new Map(
		(currentNutrientResult.data ?? []).map((nutrient) => [
			nutrient.nutrient_id,
			nutrient,
		]),
	);
	const getStatus = (origin: (typeof origins)[number] | undefined) =>
		origin?.status === "linked"
			? ("correction_submitted" as const)
			: origin?.status === "resolved"
				? ("resolved" as const)
				: ("needs_correction" as const);

	const conflictFindings: CatalogCorrectionFinding[] = actionableConflicts.map(
		(conflict) => {
			const origin = origins.find(
				(candidate) => candidate.shared_product_conflict_id === conflict.id,
			);
			const nutrientId = readNutrientId(conflict.field_path);
			const nutrientDefinition =
				nutrientId === null ? undefined : nutrientDefinitions.get(nutrientId);
			const currentNutrient =
				nutrientId === null ? undefined : currentNutrients.get(nutrientId);
			const observedRecords = Array.isArray(conflict.observed_values)
				? conflict.observed_values
						.map(readJsonRecord)
						.filter((record): record is JsonRecord => record !== null)
				: [];
			const comparisonBases = [
				...new Set(
					observedRecords.flatMap((record) =>
						typeof record.basis === "string" ? [record.basis] : [],
					),
				),
			];
			const fieldLabel = nutrientDefinition
				? nutrientDefinition.nutrient_name
				: getCatalogFieldLabel(conflict.field_path);
			const currentValue = currentNutrient
				? {
						index: null,
						source: formatSource(
							currentNutrient.source,
							currentNutrient.source_reference,
							sourceNames,
						),
						sourceKey: currentNutrient.source,
						sourceReference: currentNutrient.source_reference,
						value: formatValueWithContext(
							currentNutrient.amount_per_100g,
							currentNutrient.unit_name,
							"per 100 g",
						),
						amountPer100g: Number(currentNutrient.amount_per_100g),
						unit: formatUnit(currentNutrient.unit_name),
						observedAt: productResult.data?.last_verified_at ?? null,
						sourceType:
							sources.get(currentNutrient.source)?.source_type ?? null,
						sourceUrl:
							sources.get(currentNutrient.source)?.homepage_url ?? null,
						redistributionAllowed:
							sources.get(currentNutrient.source)?.api_redistribution_allowed ??
							null,
					}
				: productResult.data
					? (() => {
							const value = readCurrentFoodValue(
								productResult.data,
								conflict.field_path,
								sourceNames,
							);
							return value
								? {
										...value,
										index: null,
										sourceKey: productResult.data.source,
										sourceReference: productResult.data.source_reference,
										amountPer100g: null,
										unit: null,
										observedAt: productResult.data.last_verified_at,
										sourceType:
											sources.get(productResult.data.source)?.source_type ??
											null,
										sourceUrl:
											sources.get(productResult.data.source)?.homepage_url ??
											null,
										redistributionAllowed:
											sources.get(productResult.data.source)
												?.api_redistribution_allowed ?? null,
									}
								: null;
						})()
					: null;
			return {
				id: conflict.id,
				type: "catalog_conflict",
				label: "Open catalog conflict",
				fieldLabel,
				comparisonBasis:
					comparisonBases.length === 1
						? comparisonBases[0]
						: comparisonBases.length > 1
							? "Multiple reporting bases"
							: null,
				affectedFieldPaths: origin?.affected_field_paths ?? [
					conflict.field_path,
				],
				currentValue,
				evidence: Array.isArray(conflict.observed_values)
					? conflict.observed_values.map((value, index) => {
							const record = readJsonRecord(value) ?? {};
							const snapshotId =
								typeof record.snapshotId === "string"
									? record.snapshotId
									: null;
							const snapshot = snapshotId
								? snapshots.get(snapshotId)
								: undefined;
							const sourceKey =
								typeof record.source === "string"
									? record.source
									: (snapshot?.provider_key ?? "unknown");
							const sourceMetadata = sources.get(sourceKey);
							const sourceLabel =
								typeof record.source === "string"
									? formatSource(
											record.source,
											record.sourceReference,
											sourceNames,
										)
									: snapshot
										? `${sourceNames.get(snapshot.provider_key) ?? snapshot.provider_key} observation from ${new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(snapshot.observed_at))}`
										: `Observed value ${index + 1}`;
							return {
								index,
								source: sourceLabel,
								sourceKey,
								sourceReference:
									typeof record.sourceReference === "string"
										? record.sourceReference
										: (snapshot?.source_reference ?? null),
								value: formatValueWithContext(
									record.value ?? value,
									record.unitName ?? record.unit,
									record.basis,
								),
								amountPer100g:
									typeof record.value === "number" ? record.value : null,
								unit:
									typeof (record.unitName ?? record.unit) === "string"
										? formatUnit(String(record.unitName ?? record.unit))
										: null,
								observedAt:
									snapshot?.observed_at ??
									(typeof record.observedAt === "string"
										? record.observedAt
										: null),
								sourceType: sourceMetadata?.source_type ?? null,
								sourceUrl: sourceMetadata?.homepage_url ?? null,
								redistributionAllowed:
									sourceMetadata?.api_redistribution_allowed ?? null,
							};
						})
					: [],
				status: getStatus(origin),
				submissionId: origin?.submission_id ?? null,
			};
		},
	);
	const providerFindings: CatalogCorrectionFinding[] = (
		providerResult.data ?? []
	).map((review) => {
		const origin = origins.find(
			(candidate) => candidate.provider_change_review_id === review.id,
		);
		return {
			id: review.id,
			type: "provider_change",
			label: "Provider change awaiting a decision",
			fieldLabel: "Provider change",
			comparisonBasis: null,
			affectedFieldPaths:
				origin?.affected_field_paths ?? review.material_field_paths,
			evidence: [],
			currentValue: null,
			status: getStatus(origin),
			submissionId: origin?.submission_id ?? null,
		};
	});
	const warningFindings: CatalogCorrectionFinding[] = origins
		.filter((origin) => origin.food_compatibility_feedback_id !== null)
		.map((origin) => ({
			id: origin.food_compatibility_feedback_id as string,
			type: "food_warning_report",
			label: "Confirmed food-warning report",
			fieldLabel: "Food-warning evidence",
			comparisonBasis: null,
			affectedFieldPaths: origin.affected_field_paths,
			evidence: [],
			currentValue: null,
			status: getStatus(origin),
			submissionId: origin.submission_id,
		}));
	const readinessFindings: CatalogCorrectionFinding[] = readinessIssues
		.filter((issue) => issue.resolutionAction === "create_catalog_correction")
		.map((issue) => ({
			id: issue.occurrenceKey,
			type: "readiness_issue",
			label: getCatalogIssueCodeLabel(issue.issueCode),
			fieldLabel: "Catalog readiness evidence",
			comparisonBasis: null,
			affectedFieldPaths: [],
			evidence: [],
			currentValue: null,
			detail: getCatalogIssueReasonLabel(issue.sourceReason, issue.parameters),
			status: "needs_correction",
			submissionId: null,
		}));

	return {
		applicationFoodId: productResult.data
			? readApplicationFoodId(productResult.data.food)
			: null,
		servingWeightGrams: productResult.data
			? readServingWeightGrams(productResult.data.food)
			: null,
		decisionWorkbenchAvailable,
		pendingSubmissionId: pendingSubmissionResult.data?.id ?? null,
		findings: [
			...conflictFindings,
			...providerFindings,
			...warningFindings,
			...readinessFindings,
		],
	};
};
