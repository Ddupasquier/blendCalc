import {
  requireAppValue,
  throwAppError,
} from "$lib/server/errors/appError.server";
import { readCatalogProvenanceReviewRecord } from "$lib/server/products/catalogProvenanceReview.server";
import {
  getUserAppRole,
  isModerationAppRole,
} from "$lib/utils/moderation/moderation";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals, params }) => {
  const user = requireAppValue(
    await locals.getVerifiedUser(),
    401,
    "AUTH_REQUIRED",
  );
  const role = await getUserAppRole(locals.supabase, user.id);
  if (!isModerationAppRole(role)) {
    throwAppError(403, "ACCESS_DENIED");
  }

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
