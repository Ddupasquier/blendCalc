import type { Database } from "$lib/types/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type CatalogUpdateTarget = {
	sharedProductId: string;
	baseRevisionId: string;
	baseRevisionNumber: number;
};

export const readCatalogUpdateTarget = async (
	supabase: SupabaseClient<Database>,
	sharedProductId: string,
): Promise<CatalogUpdateTarget> => {
	const { data, error } = await supabase
		.from("shared_product_revisions")
		.select("id, revision_number")
		.eq("shared_product_id", sharedProductId)
		.order("revision_number", { ascending: false })
		.limit(1)
		.maybeSingle();
	if (error) throw error;
	if (!data) {
		throw new Error(
			"The active catalog product has no revision history and cannot be updated safely.",
		);
	}
	return {
		sharedProductId,
		baseRevisionId: data.id,
		baseRevisionNumber: data.revision_number,
	};
};
