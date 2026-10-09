import {
	type FoodWarningQueueKey,
	type FoodWarningQueuePage,
} from "$lib/utils/moderation/foodWarningQueuePagination";

export const fetchFoodWarningQueuePage = async <Row>(
	queue: FoodWarningQueueKey,
	cursor: string | null,
	signal: AbortSignal,
): Promise<FoodWarningQueuePage<Row>> => {
	const params = new URLSearchParams({ queue });
	if (cursor) params.set("cursor", cursor);
	const response = await fetch(
		`/api/moderation/food-warning-queues?${params}`,
		{
			signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
		},
	);
	if (!response.ok) throw new Error("Warning queue unavailable.");
	return response.json();
};

export { createProgressiveListController as createFoodWarningQueueController } from "$lib/utils/navigation/progressiveListController.svelte";
