import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "$lib/types/database.types";
import type { PrivilegedReviewSummary } from "$lib/utils/moderation/profilePrivilegedTools";

const COUNT_KEYS = [
	"pendingProductSubmissions",
	"pendingCatalogReviewItems",
	"pendingFoodWarningReports",
	"pendingProfileImageReviews",
	"pendingCatalogDataOperations",
	"totalActionableItems",
] as const;

type PrivilegedActionCountKey = (typeof COUNT_KEYS)[number];
type PrivilegedActionCounts = Record<PrivilegedActionCountKey, number>;

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

	return {
		...counts,
		unavailable: false,
		identityVerificationRequired: false,
	};
};

export const getUnavailablePrivilegedToolReviewSummary =
	(): PrivilegedReviewSummary => ({
		pendingProductSubmissions: null,
		pendingCatalogReviewItems: null,
		pendingFoodWarningReports: null,
		pendingProfileImageReviews: null,
		pendingCatalogDataOperations: null,
		totalActionableItems: null,
		unavailable: true,
		identityVerificationRequired: false,
	});

export const getIdentityVerificationRequiredPrivilegedToolReviewSummary =
	(): PrivilegedReviewSummary => ({
		pendingProductSubmissions: null,
		pendingCatalogReviewItems: null,
		pendingFoodWarningReports: null,
		pendingProfileImageReviews: null,
		pendingCatalogDataOperations: null,
		totalActionableItems: null,
		unavailable: false,
		identityVerificationRequired: true,
	});
