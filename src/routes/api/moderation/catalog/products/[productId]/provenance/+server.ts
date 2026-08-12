import { requireAppValue } from "$lib/server/errors/appError.server";
import { readCatalogProvenanceReviewRecord } from "$lib/server/products/catalogProvenanceReview.server";
import { requireModeratorApiAccess } from "$lib/server/moderation/moderationAccess.server";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals, params }) => {
  await requireModeratorApiAccess(locals);

  const record = requireAppValue(
    await readCatalogProvenanceReviewRecord(params.productId),
    404,
    "PRODUCT_NOT_FOUND",
  );

  return json(
    { data: record },
    {
      headers: {
        "cache-control": "private, no-store",
      },
    },
  );
};
