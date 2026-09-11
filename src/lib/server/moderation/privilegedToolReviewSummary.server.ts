import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "$lib/types/database.types";
import { getCatalogIssueReasonLabel } from "$lib/utils/moderation/catalogHealthMessages";
import type {
	CatalogDataOperationSubject,
	CatalogDataOperationSubjectIssue,
	PrivilegedReviewSummary,
} from "$lib/utils/moderation/profilePrivilegedTools";

const COUNT_KEYS = [
	"pendingProductSubmissions",
	"pendingCatalogReviewItems",
	"pendingFoodWarningReports",
	"pendingFoodWarningFollowUps",
	"pendingProfileImageReviews",
	"pendingCatalogDataOperations",
	"totalActionableItems",
] as const;

type PrivilegedActionCountKey = (typeof COUNT_KEYS)[number];
type PrivilegedActionCounts = Record<PrivilegedActionCountKey, number>;

const readString = (value: unknown, path: string) => {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error(`Privileged action summary has an invalid ${path}.`);
	}
	return value;
};

const readNullableString = (value: unknown, path: string) => {
	if (value === null) return null;
	return readString(value, path);
};

const parseCatalogDataOperationSubjectIssue = (
	value: unknown,
	path: string,
): CatalogDataOperationSubjectIssue => {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`Privileged action summary has an invalid ${path}.`);
	}
	const issue = value as Record<string, unknown>;
	if (
		!issue.parameters ||
		typeof issue.parameters !== "object" ||
		Array.isArray(issue.parameters)
	) {
		throw new Error(
			`Privileged action summary has invalid ${path}.parameters.`,
		);
	}
	const parameters = issue.parameters as Record<string, unknown>;
	return {
		code: readString(issue.code, `${path}.code`),
		summary: getCatalogIssueReasonLabel(
			readString(issue.sourceReason, `${path}.sourceReason`),
			parameters,
		),
		resolutionAction: readString(
			issue.resolutionAction,
			`${path}.resolutionAction`,
		),
		severity: readString(issue.severity, `${path}.severity`),
		parameters,
	};
};

const parseCatalogDataOperationSubject = (
	value: unknown,
	index: number,
): CatalogDataOperationSubject => {
	const path = `catalogDataOperationSubjects[${index}]`;
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`Privileged action summary has an invalid ${path}.`);
	}
	const subject = value as Record<string, unknown>;
	const subjectType = readString(subject.subjectType, `${path}.subjectType`);
	const subjectKey = readString(subject.subjectKey, `${path}.subjectKey`);
	const issueCount = subject.issueCount;
	if (!Number.isSafeInteger(issueCount) || (issueCount as number) < 1) {
		throw new Error(
			`Privileged action summary has an invalid ${path}.issueCount.`,
		);
	}
	if (!Array.isArray(subject.issues) || subject.issues.length < 1) {
		throw new Error(`Privileged action summary has invalid ${path}.issues.`);
	}
	const issues = subject.issues.map((issue, issueIndex) =>
		parseCatalogDataOperationSubjectIssue(
			issue,
			`${path}.issues[${issueIndex}]`,
		),
	);
	if (issues.length !== issueCount) {
		throw new Error(
			`Privileged action summary has a mismatched ${path}.issueCount.`,
		);
	}
	return {
		subjectType,
		subjectKey,
		displayName: readString(subject.displayName, `${path}.displayName`),
		context: readNullableString(subject.context, `${path}.context`),
		issueCount: issueCount as number,
		severity: readString(subject.severity, `${path}.severity`),
		summary: issues[0].summary,
		resolutionAction: readString(
			subject.resolutionAction,
			`${path}.resolutionAction`,
		),
		destination:
			readNullableString(subject.destination, `${path}.destination`) ??
			(subjectType === "generic_food_dataset"
				? `/profile/privileged-tools/data-operations/datasets/${encodeURIComponent(subjectKey)}`
				: null),
		missingPrerequisite:
			subjectType === "generic_food_dataset"
				? null
				: readNullableString(
						subject.missingPrerequisite,
						`${path}.missingPrerequisite`,
					),
		issues,
	};
};

const parsePrivilegedActionCounts = (
	value: unknown,
): PrivilegedActionCounts => {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error("Privileged action summary was not an object.");
	}

	const record = value as Record<string, unknown>;
	return Object.fromEntries(
		COUNT_KEYS.map((key) => {
			const count = record[key];
			if (!Number.isSafeInteger(count) || (count as number) < 0) {
				throw new Error(`Privileged action summary has an invalid ${key}.`);
			}
			return [key, count];
		}),
	) as PrivilegedActionCounts;
};

export const readPrivilegedToolReviewSummary = async (
	supabase: SupabaseClient<Database>,
): Promise<PrivilegedReviewSummary> => {
	const { data, error } = await supabase.rpc(
		"get_privileged_tool_action_summary",
	);
	if (error) throw error;
	const counts = parsePrivilegedActionCounts(data);
	const record = data as Record<string, unknown>;
	if (!Array.isArray(record.catalogDataOperationSubjects)) {
		throw new Error(
			"Privileged action summary has invalid catalogDataOperationSubjects.",
		);
	}
	if (typeof record.catalogDataOperationSubjectsTruncated !== "boolean") {
		throw new Error(
			"Privileged action summary has invalid catalogDataOperationSubjectsTruncated.",
		);
	}
	const catalogDataOperationSubjects = record.catalogDataOperationSubjects.map(
		parseCatalogDataOperationSubject,
	);
	if (
		!record.catalogDataOperationSubjectsTruncated &&
		catalogDataOperationSubjects.length !== counts.pendingCatalogDataOperations
	) {
		throw new Error(
			"Privileged action summary data-operations count and subject list disagree.",
		);
	}

	return {
		...counts,
		catalogDataOperationSubjects,
		catalogDataOperationSubjectsTruncated:
			record.catalogDataOperationSubjectsTruncated,
		unavailable: false,
		identityVerificationRequired: false,
	};
};

export const getUnavailablePrivilegedToolReviewSummary =
	(): PrivilegedReviewSummary => ({
		pendingProductSubmissions: null,
		pendingCatalogReviewItems: null,
		pendingFoodWarningReports: null,
		pendingFoodWarningFollowUps: null,
		pendingProfileImageReviews: null,
		pendingCatalogDataOperations: null,
		catalogDataOperationSubjects: null,
		catalogDataOperationSubjectsTruncated: false,
		totalActionableItems: null,
		unavailable: true,
		identityVerificationRequired: false,
	});

export const getIdentityVerificationRequiredPrivilegedToolReviewSummary =
	(): PrivilegedReviewSummary => ({
		pendingProductSubmissions: null,
		pendingCatalogReviewItems: null,
		pendingFoodWarningReports: null,
		pendingFoodWarningFollowUps: null,
		pendingProfileImageReviews: null,
		pendingCatalogDataOperations: null,
		catalogDataOperationSubjects: null,
		catalogDataOperationSubjectsTruncated: false,
		totalActionableItems: null,
		unavailable: false,
		identityVerificationRequired: true,
	});
