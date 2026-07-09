import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import type { FoodImageAsset } from "$lib/utils/food/types";

export const persistFoodImageAsset = async ({
	image,
	barcode,
	sharedProductId,
}: {
	image?: FoodImageAsset | null;
	barcode?: string | null;
	sharedProductId?: string | null;
}) => {
	if (!image?.imageUrl || !image.sourceReference) return;

	const admin = getSupabaseAdminClient();
	const payload = {
		barcode: barcode || null,
		shared_product_id: sharedProductId || null,
		source: image.source,
		source_reference: image.sourceReference,
		image_role: image.role,
		image_url: image.imageUrl,
		thumbnail_url: image.thumbnailUrl ?? null,
		license_name: image.licenseName,
		license_url: image.licenseUrl ?? null,
		attribution_text: image.attributionText ?? null,
		confidence: image.confidence,
		status: "active",
		fetched_at: image.fetchedAt ?? new Date().toISOString(),
	};

	const { data, error } = await admin
		.from("food_image_assets")
		.update(payload)
		.eq("source", image.source)
		.eq("source_reference", image.sourceReference)
		.eq("image_role", image.role)
		.select("id")
		.maybeSingle();

	if (error) throw error;
	if (data) return;

	const { error: insertError } = await admin
		.from("food_image_assets")
		.insert(payload);
	if (insertError && insertError.code !== "23505") throw insertError;
};
