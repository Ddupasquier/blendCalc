import type { CatalogHealthRepairResult } from "$lib/utils/moderation/catalogHealthRepair";

export const catalogHealthRepairDryRunFixture: CatalogHealthRepairResult = {
	runId: "b1000000-0000-4000-8000-000000000001",
	mode: "dry_run",
	status: "completed_with_unresolved",
	candidateCount: 2,
	changedCount: 0,
	skippedCount: 0,
	unresolvedCount: 1,
	items: [
		{
			itemKey: "nutrient:1003",
			result: "would_change",
			reasonCode: "exact_nutrient_match",
		},
		{
			itemKey: "nutrient:1004",
			result: "unresolved",
			reasonCode: "no_exact_redistributable_observation",
		},
	],
};
