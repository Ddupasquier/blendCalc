import type { Database } from "$lib/types/database.types";
import type { CanonicalFoodCatalogMetadata } from "$lib/utils/food/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type SharedProductMetadataRow = Pick<
	Database["public"]["Tables"]["shared_products"]["Row"],
	"id" | "created_at" | "updated_at" | "last_verified_at"
>;

type SharedProductRevisionMetadataRow = Pick<
	Database["public"]["Tables"]["shared_product_revisions"]["Row"],
	| "id"
	| "shared_product_id"
	| "revision_number"
	| "created_at"
	| "label_observed_at"
>;

export const readCanonicalFoodCatalogMetadata = async (
	supabase: SupabaseClient<Database>,
	sharedProductId: string,
): Promise<CanonicalFoodCatalogMetadata | null> => {
	const [productResponse, revisionResponse] = await Promise.all([
		supabase
			.from("shared_products")
			.select("id, created_at, updated_at, last_verified_at")
			.eq("id", sharedProductId)
			.maybeSingle(),
		supabase
			.from("shared_product_revisions")
			.select(
				"id, shared_product_id, revision_number, created_at, label_observed_at",
			)
			.eq("shared_product_id", sharedProductId)
			.order("revision_number", { ascending: false })
			.limit(1)
			.maybeSingle(),
	]);
	if (productResponse.error) throw productResponse.error;
	if (revisionResponse.error) throw revisionResponse.error;
	if (!productResponse.data) return null;

	const product = productResponse.data as SharedProductMetadataRow;
	const revision =
		revisionResponse.data as SharedProductRevisionMetadataRow | null;
	return {
		recordCreatedAt: product.created_at,
		recordUpdatedAt: product.updated_at,
		lastVerifiedAt: product.last_verified_at ?? undefined,
		currentRevisionId: revision?.id,
		currentRevisionNumber: revision?.revision_number,
		currentRevisionCreatedAt: revision?.created_at,
		currentLabelObservedAt: revision?.label_observed_at ?? undefined,
	};
};
