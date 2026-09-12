import type { Database } from "$lib/types/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CatalogIntakeWorkflowState = "pending" | "accepted" | "declined";

export type CatalogIntakeStatus = {
	id: string;
	state: CatalogIntakeWorkflowState;
	submittedAt: string;
	updatedAt: string;
};

const normalizeCatalogIntakeWorkflowState = (
	status: string,
	queueResolution: string | null,
): CatalogIntakeWorkflowState => {
	switch (status) {
		case "pending":
			return "pending";
		case "approved":
			return "accepted";
		case "rejected":
			return "declined";
		case "auto_declined":
			return queueResolution === "already_available" ? "accepted" : "declined";
		default:
			throw new Error("Unsupported catalog intake status.");
	}
};

export const readCatalogIntakeStatus = async (
	supabase: SupabaseClient<Database>,
	input: { submissionId: string; userId: string },
): Promise<CatalogIntakeStatus | null> => {
	if (!UUID_PATTERN.test(input.submissionId)) return null;

	let { data, error } = await supabase
		.from("shared_product_submissions")
		.select("id, status, queue_resolution, created_at, updated_at")
		.eq("id", input.submissionId)
		.eq("submitted_by", input.userId)
		.maybeSingle();

	if (error?.code === "42703" || error?.message?.includes("queue_resolution")) {
		const fallback = await supabase
			.from("shared_product_submissions")
			.select("id, status, created_at, updated_at")
			.eq("id", input.submissionId)
			.eq("submitted_by", input.userId)
			.maybeSingle();
		data = fallback.data ? { ...fallback.data, queue_resolution: null } : null;
		error = fallback.error;
	}
	if (error) throw error;
	if (!data) return null;

	return {
		id: data.id,
		state: normalizeCatalogIntakeWorkflowState(
			data.status,
			data.queue_resolution,
		),
		submittedAt: data.created_at,
		updatedAt: data.updated_at,
	};
};
