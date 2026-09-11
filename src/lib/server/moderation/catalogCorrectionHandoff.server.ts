import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import type { Json } from "$lib/types/database.types";
import {
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
	affectedFieldPaths: string[];
	detail?: string;
	evidence: Array<{ source: string; value: string }>;
	status: "needs_correction" | "correction_submitted" | "resolved";
	submissionId: string | null;
};

export type CatalogCorrectionHandoff = {
	applicationFoodId: number | null;
	pendingSubmissionId: string | null;
	findings: CatalogCorrectionFinding[];
};

const readApplicationFoodId = (food: Json): number | null => {
	if (!food || typeof food !== "object" || Array.isArray(food)) return null;
	const value = (food as Record<string, Json | undefined>).fdcId;
	const numeric = typeof value === "number" ? value : Number(value);
	return Number.isSafeInteger(numeric) && numeric !== 0 ? numeric : null;
};

export const readCatalogCorrectionHandoff = async (
	sharedProductId: string,
	readinessIssues: CatalogProductReadinessIssue[] = [],
): Promise<CatalogCorrectionHandoff> => {
	const admin = getSupabaseAdminClient();
	const [
		productResult,
		conflictResult,
		providerResult,
		originResult,
		pendingSubmissionResult,
	] = await Promise.all([
		admin
			.from("shared_products")
			.select("food")
			.eq("id", sharedProductId)
			.maybeSingle(),
		admin
			.from("shared_product_conflicts")
			.select("id, field_path, observed_values")
			.eq("shared_product_id", sharedProductId)
			.eq("status", "open")
			.order("created_at", { ascending: true }),
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

	const origins = originResult.data ?? [];
	const conflictSnapshotIds = (conflictResult.data ?? []).flatMap((conflict) =>
		Array.isArray(conflict.observed_values)
			? conflict.observed_values.flatMap((value) => {
					if (!value || typeof value !== "object" || Array.isArray(value))
						return [];
					const snapshotId = (value as Record<string, Json>).snapshotId;
					return typeof snapshotId === "string" ? [snapshotId] : [];
				})
			: [],
	);
	const snapshotResult =
		conflictSnapshotIds.length > 0
			? await admin
					.from("catalog_provider_product_snapshots")
					.select("id, provider_key, observed_at")
					.in("id", conflictSnapshotIds)
			: { data: [], error: null };
	if (snapshotResult.error) throw snapshotResult.error;
	const providerKeys = [
		...new Set(
			(snapshotResult.data ?? []).map((snapshot) => snapshot.provider_key),
		),
	];
	const sourceResult =
		providerKeys.length > 0
			? await admin
					.from("product_data_sources")
					.select("key, display_name")
					.in("key", providerKeys)
			: { data: [], error: null };
	if (sourceResult.error) throw sourceResult.error;
	const sourceNames = new Map(
		(sourceResult.data ?? []).map((source) => [
			source.key,
			source.display_name,
		]),
	);
	const snapshots = new Map(
		(snapshotResult.data ?? []).map((snapshot) => [snapshot.id, snapshot]),
	);
	const getStatus = (origin: (typeof origins)[number] | undefined) =>
		origin?.status === "linked"
			? ("correction_submitted" as const)
			: origin?.status === "resolved"
				? ("resolved" as const)
				: ("needs_correction" as const);

	const conflictFindings: CatalogCorrectionFinding[] = (
		conflictResult.data ?? []
	).map((conflict) => {
		const origin = origins.find(
			(candidate) => candidate.shared_product_conflict_id === conflict.id,
		);
		return {
			id: conflict.id,
			type: "catalog_conflict",
			label: "Open catalog conflict",
			affectedFieldPaths: origin?.affected_field_paths ?? [conflict.field_path],
			evidence: Array.isArray(conflict.observed_values)
				? conflict.observed_values.map((value, index) => {
						const record =
							value && typeof value === "object" && !Array.isArray(value)
								? (value as Record<string, Json>)
								: {};
						const snapshotId =
							typeof record.snapshotId === "string" ? record.snapshotId : null;
						const snapshot = snapshotId ? snapshots.get(snapshotId) : undefined;
						const source =
							typeof record.source === "string"
								? record.source
								: snapshot
									? `${sourceNames.get(snapshot.provider_key) ?? snapshot.provider_key} observation from ${new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(snapshot.observed_at))}`
									: `Observed value ${index + 1}`;
						return {
							source,
							value: formatCatalogEvidenceValue(record.value ?? value),
						};
					})
				: [],
			status: getStatus(origin),
			submissionId: origin?.submission_id ?? null,
		};
	});
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
			affectedFieldPaths:
				origin?.affected_field_paths ?? review.material_field_paths,
			evidence: [],
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
			affectedFieldPaths: origin.affected_field_paths,
			evidence: [],
			status: getStatus(origin),
			submissionId: origin.submission_id,
		}));
	const readinessFindings: CatalogCorrectionFinding[] = readinessIssues
		.filter((issue) => issue.resolutionAction === "create_catalog_correction")
		.map((issue) => ({
			id: issue.occurrenceKey,
			type: "readiness_issue",
			label: getCatalogIssueCodeLabel(issue.issueCode),
			affectedFieldPaths: [],
			evidence: [],
			detail: getCatalogIssueReasonLabel(issue.sourceReason, issue.parameters),
			status: "needs_correction",
			submissionId: null,
		}));

	return {
		applicationFoodId: productResult.data
			? readApplicationFoodId(productResult.data.food)
			: null,
		pendingSubmissionId: pendingSubmissionResult.data?.id ?? null,
		findings: [
			...conflictFindings,
			...providerFindings,
			...warningFindings,
			...readinessFindings,
		],
	};
};
