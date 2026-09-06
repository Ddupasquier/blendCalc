import { QueueClient } from "@vercel/queue";
import { createClient } from "@supabase/supabase-js";
import {
	isNutritionLabelOcrQueueMessage,
	type NutritionLabelOcrQueueMessage,
} from "../src/lib/server/ocr/nutritionLabelOcrQueueContract.js";
import { processNutritionLabelOcrJobWithClient } from "../src/lib/server/ocr/nutritionLabelOcrProcessor.server.js";
import type { Database } from "../src/lib/types/database.types.js";

const queueClient = new QueueClient({ region: "pdx1" });

const createSupabaseAdminClient = () => {
	const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
	const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!supabaseUrl || !serviceRoleKey) {
		throw new Error("Nutrition-label OCR storage is not configured.");
	}
	return createClient<Database>(supabaseUrl, serviceRoleKey, {
		auth: {
			autoRefreshToken: false,
			detectSessionInUrl: false,
			persistSession: false,
		},
	});
};

export default queueClient.handleNodeCallback<NutritionLabelOcrQueueMessage>(
	async (message) => {
		if (!isNutritionLabelOcrQueueMessage(message)) return;
		await processNutritionLabelOcrJobWithClient(
			message.jobId,
			createSupabaseAdminClient(),
		);
	},
	{
		visibilityTimeoutSeconds: 90,
		retry: (_error, metadata) =>
			metadata.deliveryCount >= 3
				? { acknowledge: true }
				: { afterSeconds: 2 ** metadata.deliveryCount * 5 },
	},
);
